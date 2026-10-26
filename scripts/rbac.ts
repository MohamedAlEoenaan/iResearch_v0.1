import { db } from '../src/lib/db';
import { roleDefinitions } from '../src/server/policy';
export async function seedPermissions() {
  for (const [id, role] of Object.entries(roleDefinitions)) {
    await db.role.upsert({
      where: { id },
      create: { id, label: role.label },
      update: { label: role.label },
    });
    for (const permissionId of role.permissions) {
      await db.permission.upsert({
        where: { id: permissionId },
        create: { id: permissionId },
        update: {},
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: id, permissionId } },
        create: { roleId: id, permissionId },
        update: {},
      });
    }
  }
}
