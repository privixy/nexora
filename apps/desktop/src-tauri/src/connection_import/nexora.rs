//! Native Nexora-JSON import: preview + apply operating directly on an
//! [`ExportPayload`], so no native field is lost the way the foreign-app neutral
//! envelope would drop it. Reuses the shared [`ImportPreview`] /
//! [`ImportResolution`] types and the same group-resolution semantics as
//! [`super::convert`], so the frontend renders the identical per-item picker.

use std::collections::{HashMap, HashSet};

use super::analyzer::{dup_key_existing, ImportItem, ImportItemStatus, ImportPreview};
use super::convert::{new_id, resolve_group, ImportResolution};
use crate::models::{ConnectionGroup, ExportPayload, SavedConnection};

/// Source name shown in the preview header for a Nexora JSON import.
pub const NEXORA_SOURCE_NAME: &str = "Nexora";

/// Build a preview from a parsed Nexora export payload, annotating each
/// connection against the user's existing connections (duplicate detection) and
/// seeding the group name from the payload's own group hierarchy.
pub fn preview(
    payload: &ExportPayload,
    existing: &[SavedConnection],
    registered_ids: &[String],
) -> ImportPreview {
    let existing_keys: Vec<(_, String, String)> = existing
        .iter()
        .map(|c| (dup_key_existing(c), c.id.clone(), c.name.clone()))
        .collect();

    let items = payload
        .connections
        .iter()
        .enumerate()
        .map(|(index, conn)| {
            let driver_installed = registered_ids.iter().any(|r| r == &conn.params.driver);
            let key = dup_key_existing(conn);
            let status =
                if let Some((_, id, name)) = existing_keys.iter().find(|(k, _, _)| k == &key) {
                    ImportItemStatus::Duplicate {
                        existing_id: id.clone(),
                        existing_name: name.clone(),
                    }
                } else if !driver_installed {
                    ImportItemStatus::Warnings {
                        warnings: vec![format!(
                            "Database driver \"{}\" is not installed",
                            conn.params.driver
                        )],
                    }
                } else {
                    ImportItemStatus::Ready
                };

            let group_name = conn
                .group_id
                .as_ref()
                .and_then(|gid| payload.groups.iter().find(|g| &g.id == gid))
                .map(|g| g.name.clone());

            let has_password = conn
                .params
                .password
                .as_deref()
                .is_some_and(|p| !p.trim().is_empty());
            let has_ssh =
                conn.params.ssh_enabled == Some(true) || conn.params.ssh_connection_id.is_some();

            ImportItem {
                index,
                name: conn.name.clone(),
                driver_id: conn.params.driver.clone(),
                driver_installed,
                host: conn.params.host.clone().unwrap_or_default(),
                port: conn.params.port.unwrap_or(0),
                database: conn.params.database.primary().to_string(),
                username: conn.params.username.clone().unwrap_or_default(),
                has_ssh,
                has_password,
                group_name,
                status,
            }
        })
        .collect();

    ImportPreview {
        source_name: NEXORA_SOURCE_NAME.to_string(),
        credentials_aborted: false,
        items,
    }
}

/// Apply the payload using the per-item resolutions, preserving every native
/// field and only overriding group assignment and record ids. Newly-imported
/// connections get fresh ids (with their linked SSH record remapped) so the
/// import never clobbers an unrelated existing connection; `replace` reuses the
/// chosen existing id.
pub fn apply(
    payload: &ExportPayload,
    resolutions: &[ImportResolution],
    existing_groups: &[ConnectionGroup],
) -> ExportPayload {
    let mut out = ExportPayload {
        version: 1,
        groups: Vec::new(),
        connections: Vec::new(),
        ssh_connections: Vec::new(),
        k8s_connections: Vec::new(),
    };
    let mut group_ids: HashMap<String, String> = HashMap::new();
    // Original payload group ids to preserve verbatim (with their ancestor
    // chain) for connections that keep their source group.
    let mut keep_original: HashSet<String> = HashSet::new();

    for res in resolutions {
        if res.action == "skip" {
            continue;
        }
        let conn = match payload.connections.get(res.index) {
            Some(c) => c.clone(),
            None => continue,
        };

        // Only trust an original group id that actually resolves in the payload.
        let original_group = conn
            .group_id
            .clone()
            .filter(|gid| payload.groups.iter().any(|g| &g.id == gid));

        // Group assignment mirrors `convert::build_payload`: new group by name
        // (optionally nested), an existing group id, explicit "none" (empty
        // string), or — by default — keep the source group.
        let group_id = if res.action == "replace" {
            if let Some(g) = &original_group {
                keep_original.insert(g.clone());
            }
            original_group.clone()
        } else if let Some(name) = res
            .new_group_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            let parent = res
                .new_group_parent_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            Some(resolve_group(
                name,
                parent,
                existing_groups,
                &mut group_ids,
                &mut out,
            ))
        } else if let Some(gid) = &res.group_id {
            (!gid.is_empty()).then(|| gid.clone())
        } else {
            if let Some(g) = &original_group {
                keep_original.insert(g.clone());
            }
            original_group.clone()
        };

        let mut new_conn = conn;
        new_conn.id = if res.action == "replace" {
            res.replace_existing_id.clone().unwrap_or_else(new_id)
        } else {
            new_id()
        };
        new_conn.group_id = group_id;
        new_conn.sort_order = None;

        // Remap the linked SSH record to a fresh id so the copy doesn't share
        // (and later clobber) the original's keychain entry.
        if let Some(old_ssh_id) = new_conn.params.ssh_connection_id.clone() {
            if let Some(ssh) = payload.ssh_connections.iter().find(|s| s.id == old_ssh_id) {
                let mut ssh_clone = ssh.clone();
                ssh_clone.id = new_id();
                new_conn.params.ssh_connection_id = Some(ssh_clone.id.clone());
                out.ssh_connections.push(ssh_clone);
            }
        }

        out.connections.push(new_conn);
    }

    include_group_chains(payload, &keep_original, &mut out);
    out
}

/// Add every kept original group plus its ancestor chain to `out.groups`,
/// preserving the payload's ids and hierarchy (deduped by id).
fn include_group_chains(
    payload: &ExportPayload,
    keep_original: &HashSet<String>,
    out: &mut ExportPayload,
) {
    let mut included: HashSet<String> = out.groups.iter().map(|g| g.id.clone()).collect();
    for start in keep_original {
        let mut current = Some(start.clone());
        while let Some(id) = current {
            if !included.insert(id.clone()) {
                break; // already added (and so is its chain)
            }
            match payload.groups.iter().find(|g| g.id == id) {
                Some(group) => {
                    out.groups.push(group.clone());
                    current = group.parent_id.clone();
                }
                None => break,
            }
        }
    }
}

#[cfg(test)]
mod tests;
