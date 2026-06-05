import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { Pane } from 'tweakpane'
import { launchLevel } from './launcher.ts'
import { InputTypes } from './lib/Input/_input.types.ts'
import { ELEMENT_NAMES } from './lib/Matter/elements.ts'
import type { GameLevel } from './scenes/GameLevel.ts'
import { type LevelEntry, type LevelId, LEVELS } from './scenes/Levels'

const formatInt = (v: number) => v.toFixed(0)

export type GUI = ReturnType<typeof makeGUI>

export function makeGUI(game: GameLevel) {
  const pane = new Pane({
    title: 'Debug',
    // container: document.getElementById('app')!
  })
  pane.registerPlugin(EssentialsPlugin)

  // prevent animation on initial load
  const transitionTimeMS = 200
  pane.element.classList.add('no-transition')
  setTimeout(() => {
    pane.element.classList.remove('no-transition')
  }, transitionTimeMS)

  const metrics = {
    get fps() {
      return game.game.loop.actualFps
    },
  }

  const metricsFolder = pane.addFolder({ title: 'Metrics' })
  metricsFolder.addBinding(metrics, 'fps', {
    view: 'graph',
    label: 'FPS',
    min: 0,
    max: 150,
    readonly: true,
  })

  const matter = {
    get world() {
      return game?.tilemap?.totalMatter()
    },

    get player() {
      return game?.player?.matterTank?.matterContained()
    },

    set player(val: number) {
      game?.player?.matterTank?.set(val)
    },

    get universe() {
      return this.world + this.player
    },
  }

  const matterFolder = pane.addFolder({ title: 'Matter' })
  matterFolder.addBinding(matter, 'universe', { readonly: true, format: formatInt })
  matterFolder.addBinding(matter, 'world', { readonly: true, format: formatInt })
  matterFolder.addBinding(matter, 'player', { readonly: true, format: formatInt })

  const projectiles = {
    get count() {
      return game.projectiles?.children?.length ?? 0
    },
  }
  const projectilesFolder = pane.addFolder({ title: 'Projectiles' })

  projectilesFolder.addBinding(projectiles, 'count', { readonly: true, format: formatInt })

  const physicsFolder = pane.addFolder({ title: 'Physics Bodies' })

  const physics = {
    get bodies() {
      return game.matter.world?.getAllBodies() ?? []
    },

    get total() {
      return this.bodies?.length
    },

    get static() {
      return this.bodies.filter(b => b.isStatic).length
    },

    get dynamic() {
      return this.bodies.filter(b => !b.isStatic).length
    },
    get sleeping() {
      return this.bodies.filter(b => b.isSleeping).length
    },

    get terrain() {
      return game.terrainBlobParticleManager?.particles?.length ?? 0
    },
  }

  physicsFolder.addBinding(physics, 'total', { readonly: true, format: formatInt })
  physicsFolder.addBinding(physics, 'static', { readonly: true, format: formatInt })
  physicsFolder.addBinding(physics, 'dynamic', { readonly: true, format: formatInt })
  physicsFolder.addBinding(physics, 'sleeping', { readonly: true, format: formatInt })
  physicsFolder.addBinding(physics, 'terrain', { readonly: true, format: formatInt })
  physicsFolder.addButton({ title: 'Add' })
    .on('click', () => {
      game.terrainBlobParticleManager.explode(game.player.x, game.player.y - 100, 100)
    })

  const addMatterFolder = pane.addFolder({ title: 'Add Matter' })
  ;
  [...ELEMENT_NAMES.entries()].forEach(([key, value]) => {
    addMatterFolder.addButton({ title: 'Add ' + value })
      .on('click', () => {
        game.matterBridge.addElement(key, game.player.x, game.player.y - 100)
      })
  })

  const particles = {
    get count() {
      return game?.vfxParticleManager?.emitter?.getAliveParticleCount()
    },

    get dead() {
      return game?.vfxParticleManager?.emitter?.getDeadParticleCount()
    },
  }

  const particlesFolder = pane.addFolder({ title: 'Particles' })
  particlesFolder.addBinding(particles, 'count', { readonly: true, format: formatInt })
  particlesFolder.addBinding(particles, 'dead', { readonly: true, format: formatInt })

  const input = {
    get mousePos() {
      const activePointer = game?.input?.manager?.activePointer
      if (!activePointer) return ''
      const r = game?.cameras?.main?.getWorldPoint(
        activePointer.x,
        activePointer.y,
      )

      if (!r) {
        return ''
      }

      return r.x.toFixed(0) + ', ' + r.y.toFixed(0)
    },
  }
  const inputFolder = pane.addFolder({ title: 'Input' })
  inputFolder.addBinding(input, 'mousePos', { readonly: true })

  const player = {
    get velocityX() {
      return game?.player?.container?.body?.velocity.x
    },

    get velocityY() {
      return game?.player?.container?.body?.velocity.y
    },

    get isTouching() {
      return game?.player?.isTouching
    },
  }
  const playerFolder = pane.addFolder({ title: 'Player' })
  playerFolder.addBinding(player, 'velocityX', { label: 'vx', readonly: true })
  playerFolder.addBinding(player, 'velocityY', { label: 'vy', readonly: true })
  playerFolder.addBinding(player.isTouching, 'left', { readonly: true })
  playerFolder.addBinding(player.isTouching, 'right', { readonly: true })
  playerFolder.addBinding(player.isTouching, 'ground', { readonly: true })

  const brushFolder = pane.addFolder({ title: 'Brush' })
  const getBrushBtnLabel = () => (game.inputManager.inputMode === InputTypes.BRUSH ? 'Disable' : 'Enable') + ' Brush'
  const brushToggle = brushFolder.addButton({ title: getBrushBtnLabel() })
    .on('click', () => {
      if (game.inputManager.inputMode === InputTypes.BRUSH) {
        game.inputManager.setMode(InputTypes.WEAPON)
      } else {
        game.inputManager.setMode(InputTypes.BRUSH)
      }

      brushToggle.title = getBrushBtnLabel()
    })

  const brushOptions = [...ELEMENT_NAMES.entries()].map(([key, value]) => {
    return {
      text: value,
      value: key,
    }
  })

  brushFolder.addBinding(game.inputManager.brushInput, 'element', {
    view: 'list',
    label: 'Mode',
    options: brushOptions,
  })

  const controlsFolder = pane.addFolder({ title: 'Controls' })

  controlsFolder.addButton({ title: 'Clear Local Storage + Refresh' })
    .on('click', () => {
      localStorage.clear()
      window.location.reload()
    })

  const levelsFolder = pane.addFolder({ title: 'Levels' })
  for (const [id, lvl] of Object.entries(LEVELS) as [LevelId, LevelEntry][]) {
    levelsFolder.addButton({ title: lvl.displayName })
      .on('click', () => {
        launchLevel(id)
      })
  }

  const localStorageKey = 'pane-state'

  pane.on('change', () => {
    localStorage.setItem(localStorageKey, JSON.stringify(pane.exportState()))
  })

  function load() {
    const savedState = localStorage.getItem(localStorageKey)
    if (savedState) {
      pane.importState(JSON.parse(savedState))
    }
  }

  load()

  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', () => {
      load()
    })
  }

  brushToggle.title = getBrushBtnLabel()

  return {
    setScene(newScene: GameLevel) {
      game = newScene
    },
  }
}

