# Graphify Knowledge Graph: COMOS Vessel Management System

**Generated:** 8/14/2026, 7:09:18 AM
**Architecture Summary:**
- **Total Graph Nodes:** 46
- **Connected Edges:** 50
- **Components:** 13
- **API Routes:** 14
- **Database Tables:** 13
- **Modules / Utilities:** 3
- **Code Complexity LOC:** ~42,880 lines

## 1. Components & Views
### SMSOrderList.tsx (`src/components/SMSOrderList.tsx`)
- **Description:** Interactive SMS order dispatch, checklist tracking, batch packaging, vessel uploads, and real-time sidebar status indicators.
- **API Dependencies:** `sms_orders`, `sms_upload`, `sms_checked`
- **Sub-Components:** `pdf_viewer`

### SMSView.tsx (`src/components/SMSView.tsx`)
- **Description:** SMS procedures, incident reporting, circular distribution, and acknowledgment tracking.
- **API Dependencies:** None
- **Sub-Components:** None

### CrewAndAudits.tsx (`src/components/CrewAndAudits.tsx`)
- **Description:** Crew matrix, compliance monitoring, employment registry, internal/external audits, VIR, and navigational inspection reports.
- **API Dependencies:** `crews`, `audits`
- **Sub-Components:** None

### TroubleReport.tsx (`src/components/TroubleReport.tsx`)
- **Description:** Engine/deck trouble reporting, technical defect logs (1.6 & 5.2), root cause analysis, and corrective actions.
- **API Dependencies:** `defects`
- **Sub-Components:** `image_viewer`

### SparePartsRequisition.tsx (`src/components/SparePartsRequisition.tsx`)
- **Description:** Vessel spare parts requests, PIC quotations, logistics tracking, delivery notes, and inventory status.
- **API Dependencies:** `spares`
- **Sub-Components:** `pdf_viewer`

### BunkerBDN.tsx (`src/components/BunkerBDN.tsx`)
- **Description:** Bunker delivery notes, fuel grade specifications, quantity logs, and supplier tracking.
- **API Dependencies:** `bunkers`
- **Sub-Components:** None

### BunkerFuelAnalysis.tsx (`src/components/BunkerFuelAnalysis.tsx`)
- **Description:** Lab testing results, flashpoint, viscosity, sulfur content, and compliance thresholds.
- **API Dependencies:** `bunkers`
- **Sub-Components:** None

### LubeOilAnalysis.tsx (`src/components/LubeOilAnalysis.tsx`)
- **Description:** Main Engine & Auxiliary Engine lube oil laboratory analysis, iron/wear metrics, and alert triggers.
- **API Dependencies:** `lube`
- **Sub-Components:** None

### LubeOilLDR.tsx (`src/components/LubeOilLDR.tsx`)
- **Description:** Daily lube oil consumption logs, cylinder feed rates, and stock monitoring.
- **API Dependencies:** `lube`
- **Sub-Components:** None

### PDFViewer.tsx (`src/components/PDFViewer.tsx`)
- **Description:** Embedded inline PDF renderer with zoom, multi-page navigation, and secure file streaming.
- **API Dependencies:** None
- **Sub-Components:** None

### ImageViewer.tsx (`src/components/ImageViewer.tsx`)
- **Description:** Lightbox modal with pan, rotate, zoom, and image inspection tools.
- **API Dependencies:** None
- **Sub-Components:** None

### AboutView.tsx (`src/components/AboutView.tsx`)
- **Description:** System metadata, release notes, vessel fleet summary, and developer information.
- **API Dependencies:** None
- **Sub-Components:** None

### GraphifyVisualizer.tsx (`src/components/GraphifyVisualizer.tsx`)
- **Description:** Interactive force-directed codebase knowledge graph, dependency visualizer, and blast radius impact simulator.
- **API Dependencies:** `graphify`
- **Sub-Components:** None

## 2. API Routes & Endpoints
- **`/api/sms/orders`**: Fetch, create, edit, and delete SMS fleet orders with form requirements. | **Queries Tables:** `sms_orders`, `sms_order_items`, `sms_order_vessels`, `sms_order_templates`
- **`/api/sms/orders/sidebar-status`**: Calculates urgent deadline proximity and unchecked upload alerts for sidebar notification badges. | **Queries Tables:** `sms_orders`, `sms_order_uploads`
- **`/api/sms/orders/upload`**: Multi-part file upload handler with B2/S3 sync and automated completion re-evaluation. | **Queries Tables:** `sms_order_uploads`
- **`/api/sms/orders/:id/mark-checked`**: Marks vessel uploads as verified by office/management personnel. | **Queries Tables:** `sms_order_uploads`
- **`/api/vessels`**: Fleet registry, IMO numbers, vessel specs, and team assignments. | **Queries Tables:** `vessels`
- **`/api/certificates`**: Statutory vessel certificates, expiration tracking, survey dates, and alert calculations. | **Queries Tables:** `certificates`
- **`/api/auth/login`**: JWT authentication, bcrypt password validation, and user role provisioning. | **Queries Tables:** `users`
- **`/api/crews`**: Onboard and ashore crew members, rank matrices, and contract dates. | **Queries Tables:** `crew_members`
- **`/api/audits`**: Internal, external, VIR, and navigational audit findings and corrective actions. | **Queries Tables:** `audits`
- **`/api/defects`**: Machinery breakdown tickets, root cause records, and spare allocations. | **Queries Tables:** `trouble_reports`
- **`/api/spares`**: Spare part procurement workflow, quotation approvals, and logistics notes. | **Queries Tables:** `spare_requisitions`
- **`/api/bunkers`**: Bunker delivery logs, lab test analyses, and sulfur content verifications. | **Queries Tables:** None
- **`/api/lube`**: Lube oil laboratory test data, consumption logs, and cylinder wear trends. | **Queries Tables:** None
- **`/api/graphify/graph`**: Serves the live project knowledge graph, dependency AST nodes, and impact calculations. | **Queries Tables:** None

## 3. Database Tables & Schemas
- **`sms_orders`**: Stores dispatch orders, deadline dates, instructions, and creator information. (Referenced by 2 routes/components)
- **`sms_order_uploads`**: Tracks all vessel uploaded documents, file metadata, B2 paths, and checked status. (Referenced by 3 routes/components)
- **`sms_order_items`**: Required checklist forms, allowed file extensions, and template associations. (Referenced by 1 routes/components)
- **`sms_order_vessels`**: Assigned vessels per order and completion timestamps. (Referenced by 1 routes/components)
- **`sms_order_templates`**: Reusable order configurations and preset checklist combinations. (Referenced by 1 routes/components)
- **`vessels`**: Vessel master records, flags, build years, gross tonnage, and fleet groups. (Referenced by 1 routes/components)
- **`certificates`**: Class and statutory certificates with expiration dates and file references. (Referenced by 1 routes/components)
- **`users`**: User credentials, roles (admin, user, team_pic, vessel), and permissions. (Referenced by 1 routes/components)
- **`crew_members`**: Crew profiles, nationalities, ranks, embarkation/disembarkation dates. (Referenced by 1 routes/components)
- **`audits`**: Audit reports, findings, closing dates, and auditor details. (Referenced by 1 routes/components)
- **`trouble_reports`**: Machinery issues, critical alerts, photos, and resolution plans. (Referenced by 1 routes/components)
- **`spare_requisitions`**: Part requisition orders, part numbers, quantities, and delivery status. (Referenced by 1 routes/components)
- **`audit_logs`**: Security audit trail of user actions, file deletions, and status modifications. (Referenced by 1 routes/components)
