import { type MatterDef, PHYSICS_BODY, SupportType } from '../_Matter.types.ts'

export const PHYSICS_BODY_DEF = {
  id: PHYSICS_BODY,
  name: 'Physics Body',
  immutableSupport: SupportType.AFFIXED,
  collidesWithDestroyProjectiles: false as const,
  collidesWithCreateProjectiles: false as const,
  action(): void {

  },
} satisfies MatterDef

export default PHYSICS_BODY_DEF

declare module '../matter.ts' {
  export interface MatterMetaRegistry {
    [PHYSICS_BODY]: typeof PHYSICS_BODY_DEF;
  }
}
