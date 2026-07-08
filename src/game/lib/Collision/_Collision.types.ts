import { GameObjects, Physics } from 'phaser'

// fixing phaser ts limitations
export type PhysicsBodyType =
  GameObjects.Container &
  Physics.Matter.Components.Bounce &
  Physics.Matter.Components.Collision &
  Physics.Matter.Components.Force &
  Physics.Matter.Components.Friction &
  Physics.Matter.Components.Gravity &
  Physics.Matter.Components.Mass &
  Physics.Matter.Components.Sensor &
  Physics.Matter.Components.SetBody &
  Physics.Matter.Components.Sleep &
  Physics.Matter.Components.Static &
  Physics.Matter.Components.Transform &
  Physics.Matter.Components.Velocity

type Vert = { x: number, y: number }
export type RectVerts = [Vert, Vert, Vert, Vert]