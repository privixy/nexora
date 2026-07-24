export interface ConnectionParamsDto {
  driver: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string | string[];
  ssl_mode?: string;
  ssl_ca?: string;
  ssl_cert?: string;
  ssl_key?: string;
  enable_cleartext_plugin?: boolean;
  pipes_as_concat?: boolean;
  ssh_enabled?: boolean;
  ssh_connection_id?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
  ssh_key_passphrase?: string;
  ssh_allow_passphrase_prompt?: boolean;
  save_in_keychain?: boolean;
  k8s_enabled?: boolean;
  k8s_connection_id?: string;
  k8s_context?: string;
  k8s_namespace?: string;
  k8s_resource_type?: string;
  k8s_resource_name?: string;
  k8s_port?: number;
  startup_script?: string;
}

export interface SavedConnectionDto {
  id: string;
  name: string;
  params: ConnectionParamsDto;
  group_id?: string;
  sort_order?: number;
  detect_json_in_text_columns?: boolean;
}
