use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value as JsonValue;
use tokio_postgres::types::{FromSql, Type};
use uuid::Uuid;

use crate::drivers::common::{encode_blob, i64_to_json};

use super::advanced_types;

#[inline]
pub fn extract_or_null(ty: &Type, buf: &[u8]) -> JsonValue {
    match *ty {
        Type::BOOL => JsonValue::from(from_sql_or_none::<bool>(ty, buf)),
        Type::BYTEA => {
            JsonValue::from(from_sql_or_none::<Vec<u8>>(ty, buf).map(|b| encode_blob(&b)))
        }

        // numeric
        Type::CHAR => JsonValue::from(from_sql_or_none::<i8>(ty, buf)), // this mapped to `i8`
        Type::INT2 => JsonValue::from(from_sql_or_none::<i16>(ty, buf)),
        Type::INT4 => JsonValue::from(from_sql_or_none::<i32>(ty, buf)),
        Type::INT8 => from_sql_or_none::<i64>(ty, buf)
            .map(i64_to_json)
            .unwrap_or(JsonValue::Null),
        Type::FLOAT4 => JsonValue::from(from_sql_or_none::<f32>(ty, buf)),
        Type::FLOAT8 => JsonValue::from(from_sql_or_none::<f64>(ty, buf)),
        Type::NUMERIC => {
            JsonValue::from(from_sql_or_none::<Decimal>(ty, buf).map(|d| d.to_string()))
        }
        Type::OID => JsonValue::from(from_sql_or_none::<u32>(ty, buf)),

        // text
        Type::TEXT => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::VARCHAR => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::BPCHAR => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::UNKNOWN => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::NAME => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        ref ty if ["citext", "ltree", "lquery", "ltxtquery"].contains(&ty.name()) => {
            JsonValue::from(from_sql_or_none::<String>(ty, buf))
        }

        // uuid
        Type::UUID => JsonValue::from(from_sql_or_none::<Uuid>(ty, buf).map(|u| u.to_string())),

        // date/time
        Type::DATE => JsonValue::from(
            from_sql_or_none::<NaiveDate>(ty, buf).map(|d| d.format("%Y-%m-%d").to_string()),
        ),
        Type::TIME => JsonValue::from(
            from_sql_or_none::<NaiveTime>(ty, buf).map(|t| t.format("%H:%M:%S").to_string()),
        ),
        Type::TIMESTAMP => JsonValue::from(
            from_sql_or_none::<NaiveDateTime>(ty, buf)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
        ),
        Type::TIMESTAMPTZ => JsonValue::from(
            from_sql_or_none::<DateTime<Utc>>(ty, buf)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
        ),
        Type::INTERVAL => JsonValue::from(from_sql_or_none::<advanced_types::Interval>(ty, buf)),
        Type::TIMETZ => JsonValue::from(from_sql_or_none::<advanced_types::TimeTz>(ty, buf)),

        // json
        Type::JSON => JsonValue::from(from_sql_or_none::<JsonValue>(ty, buf)),
        Type::JSONB => JsonValue::from(from_sql_or_none::<JsonValue>(ty, buf)),

        // HashMap
        ref ty if ty.name() == "hstore" => {
            serde_json::to_value(from_sql_or_none::<HashMap<String, Option<String>>>(ty, buf))
                .unwrap_or_default()
        }

        // Network types
        Type::MACADDR => JsonValue::from(from_sql_or_none::<advanced_types::MacAddr>(ty, buf)),
        Type::MACADDR8 => JsonValue::from(from_sql_or_none::<advanced_types::MacAddr8>(ty, buf)),
        Type::INET => JsonValue::from(from_sql_or_none::<advanced_types::CidrOrInet>(ty, buf)),
        Type::CIDR => JsonValue::from(from_sql_or_none::<advanced_types::CidrOrInet>(ty, buf)),
        Type::BIT => JsonValue::from(from_sql_or_none::<advanced_types::BitOrVarBit>(ty, buf)),
        Type::VARBIT => JsonValue::from(from_sql_or_none::<advanced_types::BitOrVarBit>(ty, buf)),

        // System Identifiers
        Type::XID => JsonValue::from(from_sql_or_none::<advanced_types::Xid>(ty, buf)),
        Type::CID => JsonValue::from(from_sql_or_none::<advanced_types::Cid>(ty, buf)),
        Type::TID => JsonValue::from(from_sql_or_none::<advanced_types::Tid>(ty, buf)),
        Type::XID8 => JsonValue::from(from_sql_or_none::<advanced_types::Xid8>(ty, buf)),

        // Object References (The "Reg" Types)
        Type::REGPROC => JsonValue::from(from_sql_or_none::<advanced_types::RegProc>(ty, buf)),
        Type::REGPROCEDURE => {
            JsonValue::from(from_sql_or_none::<advanced_types::RegProcedure>(ty, buf))
        }
        Type::REGOPER => JsonValue::from(from_sql_or_none::<advanced_types::RegOper>(ty, buf)),
        Type::REGOPERATOR => {
            JsonValue::from(from_sql_or_none::<advanced_types::RegOperator>(ty, buf))
        }
        Type::REGCLASS => JsonValue::from(from_sql_or_none::<advanced_types::RegClass>(ty, buf)),
        Type::REGTYPE => JsonValue::from(from_sql_or_none::<advanced_types::RegType>(ty, buf)),
        Type::REGCONFIG => JsonValue::from(from_sql_or_none::<advanced_types::RegConfig>(ty, buf)),
        Type::REGDICTIONARY => {
            JsonValue::from(from_sql_or_none::<advanced_types::RegDictionary>(ty, buf))
        }
        Type::REGNAMESPACE => {
            JsonValue::from(from_sql_or_none::<advanced_types::RegNamespace>(ty, buf))
        }
        Type::REGROLE => JsonValue::from(from_sql_or_none::<advanced_types::RegRole>(ty, buf)),
        Type::REGCOLLATION => {
            JsonValue::from(from_sql_or_none::<advanced_types::RegCollation>(ty, buf))
        }

        // Geometric Types
        Type::POINT => JsonValue::from(from_sql_or_none::<advanced_types::Point>(ty, buf)),
        Type::LSEG => JsonValue::from(from_sql_or_none::<advanced_types::Lseg>(ty, buf)),
        Type::BOX => JsonValue::from(from_sql_or_none::<advanced_types::PgBox>(ty, buf)),
        Type::POLYGON => JsonValue::from(from_sql_or_none::<advanced_types::Polygon>(ty, buf)),
        Type::PATH => JsonValue::from(from_sql_or_none::<advanced_types::Path>(ty, buf)),
        Type::LINE => JsonValue::from(from_sql_or_none::<advanced_types::Line>(ty, buf)),
        Type::CIRCLE => JsonValue::from(from_sql_or_none::<advanced_types::Circle>(ty, buf)),

        // uft8 text
        Type::JSONPATH => JsonValue::from(from_sql_or_none::<advanced_types::JsonPath>(ty, buf)),
        Type::XML => JsonValue::from(from_sql_or_none::<advanced_types::Xml>(ty, buf)),
        Type::REFCURSOR => JsonValue::from(from_sql_or_none::<advanced_types::RefCursor>(ty, buf)),
        Type::ACLITEM => JsonValue::from(from_sql_or_none::<advanced_types::AclItem>(ty, buf)),
        Type::PG_NODE_TREE => {
            JsonValue::from(from_sql_or_none::<advanced_types::PgNodeTree>(ty, buf))
        }

        Type::MONEY => JsonValue::from(from_sql_or_none::<advanced_types::Money>(ty, buf)),

        // Full Text Search types
        Type::TS_VECTOR => JsonValue::from(from_sql_or_none::<advanced_types::TsVector>(ty, buf)),
        Type::TSQUERY => JsonValue::from(from_sql_or_none::<advanced_types::TsQuery>(ty, buf)),
        Type::GTS_VECTOR => JsonValue::from(from_sql_or_none::<advanced_types::GtsVector>(ty, buf)),

        // Internal System, Snapshots & Statistics postgres types
        Type::PG_LSN => JsonValue::from(from_sql_or_none::<advanced_types::PgLsn>(ty, buf)),
        Type::PG_SNAPSHOT => {
            JsonValue::from(from_sql_or_none::<advanced_types::TxidSnapshotOrPgSnapshot>(ty, buf))
        }
        Type::TXID_SNAPSHOT => {
            JsonValue::from(from_sql_or_none::<advanced_types::TxidSnapshotOrPgSnapshot>(ty, buf))
        }
        Type::PG_NDISTINCT => {
            JsonValue::from(from_sql_or_none::<advanced_types::PgNdistinct>(ty, buf))
        }
        Type::PG_DEPENDENCIES => {
            JsonValue::from(from_sql_or_none::<advanced_types::PgDependencies>(ty, buf))
        }
        Type::PG_BRIN_BLOOM_SUMMARY => JsonValue::from(from_sql_or_none::<
            advanced_types::PgBrinBloomSummary,
        >(ty, buf)),
        Type::PG_BRIN_MINMAX_MULTI_SUMMARY => {
            JsonValue::from(from_sql_or_none::<advanced_types::PgBrinMinmaxMultiSummary>(ty, buf))
        }
        Type::PG_MCV_LIST => {
            JsonValue::from(from_sql_or_none::<advanced_types::PgMcvList>(ty, buf))
        }

        _ => JsonValue::Null,
    }
}

#[inline]
fn from_sql_or_none<'a, T>(ty: &Type, buf: &'a [u8]) -> Option<T>
where
    T: FromSql<'a>,
{
    match <Option<T> as FromSql>::from_sql(ty, buf) {
        Ok(value) => value,
        Err(e) => {
            log::error!("Failed to read value from sql: {:?}", e);
            None
        }
    }
}

#[cfg(test)]
mod tests;
