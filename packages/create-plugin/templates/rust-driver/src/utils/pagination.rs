//! Pagination helpers.

/// Wrap a SELECT with LIMIT/OFFSET. Page numbers are 1-indexed.
///
/// ```
/// assert_eq!(
///   paginate("SELECT * FROM users", 2, 50),
///   "SELECT * FROM users LIMIT 50 OFFSET 50"
/// );
/// ```
pub fn paginate(query: &str, page: u64, page_size: u64) -> String {
    let safe_page = page.max(1);
    let offset = (safe_page - 1).saturating_mul(page_size);
    format!("{} LIMIT {} OFFSET {}", query.trim(), page_size, offset)
}

#[cfg(test)]
mod tests;
