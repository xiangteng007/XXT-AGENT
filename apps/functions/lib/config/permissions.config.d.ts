/**
 * RBAC Permissions Configuration
 * Defines the permission matrix for all roles
 */
import { Role, Resource, Action, Permission } from '../types/rbac.types';
/**
 * Permission matrix defining which roles can perform which actions on resources
 *
 * Structure: ROLE_PERMISSIONS[role][resource] = allowed actions
 */
export declare const ROLE_PERMISSIONS: Record<Role, Record<Resource, Action[]>>;
/**
 * Role display names (Chinese)
 */
export declare const ROLE_DISPLAY_NAMES: Record<Role, string>;
/**
 * Role descriptions
 */
export declare const ROLE_DESCRIPTIONS: Record<Role, string>;
/**
 * Resource display names (Chinese)
 */
export declare const RESOURCE_DISPLAY_NAMES: Record<Resource, string>;
/**
 * Action display names (Chinese)
 */
export declare const ACTION_DISPLAY_NAMES: Record<Action, string>;
/**
 * Check if a role has permission for a specific resource and action
 */
export declare function hasPermission(role: Role, resource: Resource, action: Action): boolean;
/**
 * Get all permissions for a role
 */
export declare function getRolePermissions(role: Role): Permission[];
/**
 * Get roles that can perform a specific action on a resource
 */
export declare function getRolesWithPermission(resource: Resource, action: Action): Role[];
/**
 * Get the minimum role required for a specific action on a resource
 */
export declare function getMinimumRole(resource: Resource, action: Action): Role | null;
//# sourceMappingURL=permissions.config.d.ts.map