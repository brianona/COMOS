export interface Team {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  role: "admin" | "user" | "vessel" | "team_pic";
  team_ids: number[];
  vessel_id?: number | null;
  email?: string;
  device_id?: string | null;
  is_verified?: boolean;
  plain_password?: string | null;
}

export interface DeviceRegistrationRequest {
  id: number;
  user_id: number;
  username: string;
  vessel_name: string;
  device_code: string;
  device_id: string;
  label?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface RegisteredDevice {
  id: number;
  username: string;
  device_id: string;
  is_verified: boolean;
  vessel_name: string | null;
}

export interface Vessel {
  id: number;
  name: string;
  team_id: number;
  team_name?: string;
  owner?: "Nissen" | "Goodwill";
  fleet_status?: "In Active Fleet" | "Out of Management";
  has_photo?: boolean;
  next_port?: string | null;
  route_status?: string | null;
  shackles?: string | number | null;
  loading_status?: string | null;
  eta_atb?: string | null;
  etb?: string | null;
  etd_atd?: string | null;
  cargo?: string | null;
  operation_type?: string | null;
  remark_from_vessel?: string | null;
  flag?: string | null;
  type?: "Bulk Carrier" | "Container";
  email?: string | null;
  date_built?: string | null;
  min_fuel_consumption?: string | null;
  max_fuel_consumption?: string | null;
  charterer_min_hsfo?: string | null;
  charterer_max_hsfo?: string | null;
  charterer_min_lsfo?: string | null;
  charterer_max_lsfo?: string | null;
  charterer_min_mgo?: string | null;
  charterer_max_mgo?: string | null;
  charterer_min_mdo?: string | null;
  charterer_max_mdo?: string | null;
}

export interface VesselFlag {
  id: number;
  name: string;
}

export interface Certificate {
  id: number;
  vessel_id: number | null;
  team_id: number;
  vessel_name: string | null;
  team_name: string;
  owner?: "Nissen" | "Goodwill" | null;
  name: string;
  expiration_date: string;
  date_issued?: string | null;
  certificate_number?: string | null;
  access_type: "office" | "vessel" | "any";
  has_file?: boolean;
}

export interface DepartureReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  departure_port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_port_hsfo: number;
  foc_port_lsfo: number;
  foc_port_mgo: number;
  foc_port_mdo: number;
  attachment_id?: number | null;
  created_at: string;
  vessel_name?: string;
  attachment_name?: string;
}

export interface ArrivalReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  arrival_port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  total_time_at_sea: string;
  total_distance: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_sea_hsfo: number;
  foc_sea_lsfo: number;
  foc_sea_mgo: number;
  foc_sea_mdo: number;
  agent_detail: string;
  attachment_id?: number | null;
  created_at: string;
  vessel_name?: string;
  attachment_name?: string;
}

export interface NoonReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  position_long: string;
  position_lat: string;
  distance_to_go: string;
  cargo_status: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  foc_hsfo: number;
  foc_lsfo: number;
  foc_mgo: number;
  foc_mdo: number;
  created_at: string;
  vessel_name?: string;
  attachment_id?: number;
  attachment_name?: string;
  weather_notation?: string | null;
  swell_scale_21?: string | null;
  wind_scale?: string | null;
  wave_scale?: string | null;
  weather_image?: string | null;
  remarks?: string | null;
  destination_port?: string | null;
  eta_utc?: string | null;
  agent_details?: string | null;
  charterer_min_hsfo?: string | null;
  charterer_max_hsfo?: string | null;
  charterer_min_lsfo?: string | null;
  charterer_max_lsfo?: string | null;
  charterer_min_mgo?: string | null;
  charterer_max_mgo?: string | null;
  charterer_min_mdo?: string | null;
  charterer_max_mdo?: string | null;
}

export interface OtherReport {
  id: number;
  vessel_id: number;
  user_id: number;
  voyage_number: string;
  utc_date_time: string;
  port: string;
  eu_uk_status: string;
  position_long: string;
  position_lat: string;
  operation_type: string;
  cargo_status: string;
  rob_type: string;
  rob_hsfo: number;
  rob_lsfo: number;
  rob_mgo: number;
  rob_mdo: number;
  rob_fw: number;
  foc_port_hsfo: number;
  foc_port_lsfo: number;
  foc_port_mgo: number;
  foc_port_mdo: number;
  created_at: string;
  vessel_name?: string;
}

export interface Note {
  id: number;
  certificate_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

export interface FileData {
  id: number;
  certificate_id: number;
  filename: string;
  original_name: string;
  mimetype?: string;
  file_type: "certificate" | "supporting";
  upload_date: string;
}

export interface Notification {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export interface DBStatus {
  connected: boolean;
  engine?: string;
  details?: {
    host?: string;
    port?: string | number;
    user?: string;
    database?: string;
    error?: string | null;
  };
  error?: string | null;
  errorCode?: string | null;
  tcpStatus?: string;
  webStatus?: string;
  outboundIp?: string;
  config?: any;
}

export type ViewType =
  | "dashboard"
  | "vessels"
  | "vessel_details"
  | "routing"
  | "admin"
  | "slideshow"
  | "departure"
  | "arrival"
  | "noon_to_noon"
  | "noon"
  | "fuel_consumption"
  | "admin_vessel_list"
  | "admin_cert_list"
  | "admin_new_vessel"
  | "admin_add_cert"
  | "other_report"
  | "other_reports"
  | "admin_recycle_bin"
  | "defects_5_2"
  | "defects_1_6"
  | "spare_requisition_ship"
  | "spare_quotation_pic"
  | "spare_logistic_pic"
  | "spare_delivery_note_ship"
  | "bunker_bdn"
  | "bunker_fuel_analysis"
  | "lube_oil_analysis"
  | "lube_oil_requisition"
  | "lube_oil_ldr"
  | "store_requisition"
  | "chemical_requisition"
  | "store_chemical_requisition"
  | "crew_list"
  | "crew_compliance"
  | "crew_employment"
  | "audit_list"
  | "audit_internal"
  | "audit_external"
  | "audit_vir"
  | "audit_navigational"
  | "audit_registry"
  | "about"
  | "sms"
  | "sms_overview"
  | "sms_reporting"
  | "sms_acknowledgement"
  | "sms_order_list"
  | "sms_find_report"
  | "graphify"
  | "trouble_reports"
  | "spare_parts_requisition"
  | "recycle_bin";
