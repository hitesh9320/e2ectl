import type { ApiEnvelope } from './api.js';

export interface NodeSummary {
  id: number;
  is_locked?: boolean;
  name: string;
  plan: string;
  private_ip_address?: string | null;
  public_ip_address?: string | null;
  status: string;
}

export interface NodeOsInfo {
  category?: string;
  full_name?: string;
  name?: string;
  version?: string;
}

export interface NodeDetails extends NodeSummary {
  created_at?: string;
  disk?: string;
  label?: string;
  location?: string;
  memory?: string;
  os_info?: NodeOsInfo;
  price?: string;
  vm_id?: number;
  vcpus?: string;
}

export interface NodeListEnvelope extends ApiEnvelope<NodeSummary[]> {
  total_count?: number;
  total_page_number?: number;
}

export interface NodeCreateRequest {
  backups: boolean;
  default_public_ip: boolean;
  disable_password: boolean;
  enable_bitninja: boolean;
  image: string;
  is_ipv6_availed: boolean;
  is_saved_image: boolean;
  label: string;
  name: string;
  number_of_instances: number;
  plan: string;
  ssh_keys: string[];
  start_scripts: string[];
}

export interface NodeCreateResult {
  node_create_response: NodeDetails[];
  total_number_of_node_created: number;
  total_number_of_node_requested: number;
}

export type NodeDeleteResult = Record<string, never>;
