import { z } from 'zod';

// ============================================================
// COMPONENT SCHEMAS
// ============================================================

export const componentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  manufacturerId: z.string().optional().nullable(),
  mpn: z.string().optional().nullable(),
  genericPartNumber: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  
  quantityOwned: z.number().int().min(0).default(0),
  quantityAvailable: z.number().int().min(0).default(0),
  quantityReserved: z.number().int().min(0).default(0),
  quantityInUse: z.number().int().min(0).default(0),
  quantityLentOut: z.number().int().min(0).default(0),
  quantityBorrowed: z.number().int().min(0).default(0),
  
  condition: z.enum(['New', 'Good', 'Fair', 'Poor', 'Damaged', 'Unknown']).default('New'),
  unitOfMeasurement: z.string().default('pcs'),
  ownershipType: z.enum(['Personal', 'Borrowed']).default('Personal'),
  
  acquisitionDate: z.string().optional().nullable(),
  acquisitionMethod: z.enum(['Purchased', 'Gift', 'Salvaged', 'Sample', 'Other']).optional().nullable(),
  unitCost: z.number().min(0).optional().nullable(),
  currency: z.string().default('INR'),
  supplierId: z.string().optional().nullable(),
  
  manufacturerUrl: z.string().url().optional().nullable().or(z.literal('')),
  datasheetUrl: z.string().url().optional().nullable().or(z.literal('')),
  pinoutUrl: z.string().url().optional().nullable().or(z.literal('')),
  cadUrl: z.string().url().optional().nullable().or(z.literal('')),
  schematicUrl: z.string().url().optional().nullable().or(z.literal('')),
  
  storageLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  minimumStock: z.number().int().min(0).optional().nullable(),
  
  // Related data
  tagIds: z.array(z.string()).optional(),
  specifications: z.array(z.object({
    fieldName: z.string(),
    textValue: z.string().optional().nullable(),
    numericValue: z.number().optional().nullable(),
    unit: z.string().optional().nullable(),
  })).optional(),
});

export const componentUpdateSchema = componentCreateSchema.partial();

export type ComponentCreateInput = z.infer<typeof componentCreateSchema>;
export type ComponentUpdateInput = z.infer<typeof componentUpdateSchema>;

// ============================================================
// CATEGORY SCHEMAS
// ============================================================

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isCustom: z.boolean().default(false),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

// ============================================================
// MANUFACTURER SCHEMAS
// ============================================================

export const manufacturerCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  website: z.string().url().optional().nullable().or(z.literal('')),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ManufacturerCreateInput = z.infer<typeof manufacturerCreateSchema>;

// ============================================================
// SUPPLIER SCHEMAS
// ============================================================

export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  website: z.string().url().optional().nullable().or(z.literal('')),
  contact: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

// ============================================================
// PERSON SCHEMAS
// ============================================================

export const personCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PersonCreateInput = z.infer<typeof personCreateSchema>;

// ============================================================
// TAG SCHEMAS
// ============================================================

export const tagCreateSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().optional().nullable(),
});

export type TagCreateInput = z.infer<typeof tagCreateSchema>;

// ============================================================
// INVENTORY TRANSACTION SCHEMAS
// ============================================================

export const transactionTypes = [
  'INITIAL', 'ADD', 'REMOVE', 'USE', 'RESERVE', 'RELEASE_RESERVE',
  'BORROW', 'RETURN_BORROWED', 'LEND', 'RETURN_LENT',
  'DAMAGE', 'LOSS', 'CORRECTION'
] as const;

export const transactionCreateSchema = z.object({
  componentId: z.string().min(1),
  transactionType: z.enum(transactionTypes),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  relatedPersonId: z.string().optional().nullable(),
  relatedProjectId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;

// ============================================================
// BORROW RECORD SCHEMAS
// ============================================================

export const borrowRecordCreateSchema = z.object({
  componentId: z.string().min(1),
  borrowedFromId: z.string().min(1, 'Must specify who you borrowed from'),
  quantity: z.number().int().min(1).default(1),
  dateBorrowed: z.string().optional(),
  expectedReturnDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type BorrowRecordCreateInput = z.infer<typeof borrowRecordCreateSchema>;

// ============================================================
// LEND RECORD SCHEMAS
// ============================================================

export const lendRecordCreateSchema = z.object({
  componentId: z.string().min(1),
  lentToId: z.string().min(1, 'Must specify who you are lending to'),
  quantity: z.number().int().min(1).default(1),
  dateLent: z.string().optional(),
  expectedReturnDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type LendRecordCreateInput = z.infer<typeof lendRecordCreateSchema>;

// ============================================================
// PROJECT SCHEMAS
// ============================================================

export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().optional().nullable(),
  status: z.enum(['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']).default('Planning'),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  relatedLinks: z.string().optional().nullable(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

// ============================================================
// PROJECT COMPONENT SCHEMAS
// ============================================================

export const projectComponentSchema = z.object({
  projectId: z.string().min(1),
  componentId: z.string().min(1),
  plannedQuantity: z.number().int().min(0).default(0),
  reservedQuantity: z.number().int().min(0).default(0),
  usedQuantity: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export type ProjectComponentInput = z.infer<typeof projectComponentSchema>;

// ============================================================
// PURCHASE ITEM SCHEMAS
// ============================================================

export const purchaseItemCreateSchema = z.object({
  componentId: z.string().optional().nullable(),
  componentName: z.string().min(1, 'Component name is required'),
  quantity: z.number().int().min(1).default(1),
  estimatedCost: z.number().min(0).optional().nullable(),
  currency: z.string().default('INR'),
  supplierId: z.string().optional().nullable(),
  supplierUrl: z.string().url().optional().nullable().or(z.literal('')),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
  status: z.enum(['Needed', 'Ordered', 'Received', 'Cancelled']).default('Needed'),
  notes: z.string().optional().nullable(),
});

export type PurchaseItemCreateInput = z.infer<typeof purchaseItemCreateSchema>;

// ============================================================
// SAVED SEARCH SCHEMAS
// ============================================================

export const savedSearchCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional().nullable(),
  filters: z.string(), // JSON string
  sorting: z.string().optional().nullable(),
  visibleColumns: z.string().optional().nullable(),
  pageSize: z.number().int().min(5).max(200).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateSchema>;

// ============================================================
// DOCUMENT SCHEMAS
// ============================================================

export const documentCreateSchema = z.object({
  componentId: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['datasheet', 'pinout', 'schematic', 'image', 'code', 'application_note', 'test_result', 'pcb_footprint', 'cad_model', 'other']),
  url: z.string().url().optional().nullable().or(z.literal('')),
  filePath: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

// ============================================================
// SETTINGS SCHEMAS
// ============================================================

export const userSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  defaultCurrency: z.string().default('INR'),
  defaultUnit: z.string().default('pcs'),
  defaultPageSize: z.number().int().min(5).max(200).default(25),
  defaultSortField: z.string().default('updatedAt'),
  defaultSortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFormat: z.string().default('DD/MM/YYYY'),
  lowStockThreshold: z.number().int().min(0).default(5),
  defaultVisibleColumns: z.string().optional().nullable(),
  defaultSavedSearchId: z.string().optional().nullable(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

// ============================================================
// CUSTOM FIELD SCHEMAS
// ============================================================

export const customFieldDefinitionSchema = z.object({
  name: z.string().min(1, 'Field name is required').max(100),
  fieldKey: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Field key must be lowercase alphanumeric with underscores'),
  fieldType: z.enum(['text', 'number', 'boolean', 'date', 'select', 'multiselect']),
  options: z.string().optional().nullable(), // JSON array
  categoryId: z.string().optional().nullable(),
  isFilterable: z.boolean().default(true),
  isSortable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionSchema>;

// ============================================================
// FILTER & SEARCH SCHEMAS
// ============================================================

export const searchParamsSchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().optional(),
  subcategory: z.string().optional(),
  manufacturerId: z.string().optional(),
  supplierId: z.string().optional(),
  ownershipType: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  tagIds: z.string().optional(), // comma-separated
  minQuantity: z.string().optional(),
  maxQuantity: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  lowStock: z.string().optional(),
  hasDatasheet: z.string().optional(),
  hasImage: z.string().optional(),
  isArchived: z.string().optional(),
  projectId: z.string().optional(),
  borrowedFromId: z.string().optional(),
  lentToId: z.string().optional(),
  
  // Technical spec filters
  specFilters: z.string().optional(), // JSON string of spec filters
  
  // Sorting
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  
  // Pagination
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;
