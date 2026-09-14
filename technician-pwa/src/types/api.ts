export interface Envelope<T> { success: boolean; data: T; meta?: {total?: number}; messages?: {message?: string; level?: string}[] }
export interface Card { _id: number; _type: string; _beginDate?: string; [key: string]: unknown }
export interface Session { _id: string; username: string; userDescription?: string; role: string; availableRoles?: string[]; rolePrivileges?: Record<string, boolean> }
export interface Lookup { _id: number; code: string; description: string; _description_translation?: string; active: boolean }
export interface AttributeDetail { name: string; type: string; description: string; lookupType?: string; targetClass?: string; validationRules?: string; ecqlFilter?: {id: string; bindings?: {server?: string[]; client?: string[]}}; mandatory?: boolean; writable?: boolean; _can_create?: boolean }
export interface ActivityAttribute { _id: string; writable: boolean; mandatory: boolean; detail: AttributeDetail }
export interface Widget { _id: string; _type: string; _active: boolean; _required?: boolean; CostState?: string; [key: string]: unknown }
export interface Activity { _id: string; _definition: string; description: string; writable: boolean; performer?: string; _performer_description?: string; attributes?: ActivityAttribute[]; widgets?: Widget[] }
export interface Attachment { _id: string; name: string; description?: string; category: number; _category_description?: string }
