import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

interface ModuleGraph {
  [file: string]: string[]
}

function getValueImports(sourceFile: ts.SourceFile, filePath: string): string[] {
  const valueImports: string[] = []
  const fileDir = path.dirname(filePath)

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      // Check if import is type-only
      const isTypeOnly = node.importClause?.isTypeOnly

      if (!isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const importPath = node.moduleSpecifier.text

        // Resolve relative imports
        if (importPath.startsWith('.')) {
          const resolved = path.resolve(fileDir, importPath)
          valueImports.push(resolved)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return valueImports
}

function buildModuleGraph(rootDir: string): ModuleGraph {
  const graph: ModuleGraph = {}

  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        scanDirectory(fullPath)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const sourceFile = ts.createSourceFile(
          fullPath,
          content,
          ts.ScriptTarget.Latest,
          true,
        )

        graph[fullPath] = getValueImports(sourceFile, fullPath)
      }
    }
  }

  scanDirectory(rootDir)
  return graph
}

function findCircularDependencies(graph: ModuleGraph): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node)
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node])
      }
      return
    }

    if (visited.has(node)) return

    visited.add(node)
    recursionStack.add(node)

    const imports = graph[node] || []

    for (const imp of imports) {
      // Find matching files (handle missing extensions)
      for (const file of Object.keys(graph)) {
        if (
          file === imp ||
          file === `${imp}.ts` ||
          file === `${imp}.tsx` ||
          file.replace(/\.(ts|tsx)$/, '') === imp
        ) {
          dfs(file, [...path, node])
        }
      }
    }

    recursionStack.delete(node)
  }

  for (const node of Object.keys(graph)) {
    visited.clear()
    recursionStack.clear()
    dfs(node, [])
  }

  // Remove duplicates
  return cycles.filter((cycle, index, self) => {
    const cycleStr = cycle.join('->')
    return self.findIndex(c => c.join('->') === cycleStr) === index
  })
}

// Run the checker
const srcDir = path.join(process.cwd(), 'src')
console.log('🔍 Checking for circular value dependencies...\n')

const graph = buildModuleGraph(srcDir)
const cycles = findCircularDependencies(graph)

if (cycles.length === 0) {
  console.log('✅ No circular value dependencies found')
  process.exit(0)
} else {
  console.log('❌ Circular value dependencies found:\n')
  cycles.forEach((cycle, i) => {
    console.log(`\nCycle ${i + 1}:`)
    cycle.forEach(file => {
      console.log(`  ${path.relative(process.cwd(), file)}`)
    })
  })
  process.exit(1)
}
