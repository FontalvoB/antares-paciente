import { readFileSync } from 'node:fs'

const plist = readFileSync('ios/App/App/Info.plist', 'utf8')

if (plist.includes('NSAllowsArbitraryLoads') || plist.includes('NSAllowsLocalNetworking')) {
  console.error('FALLA: Info.plist tiene ATS de desarrollo; revertir antes de archivar.')
  process.exit(1)
}

// El número calculado por Fastlane debe llegar al binario, no solo al nombre del IPA.
if (!/<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/.test(plist)) {
  console.error('FALLA: CFBundleVersion debe usar $(CURRENT_PROJECT_VERSION) para recibir el número de build de Fastlane.')
  process.exit(1)
}

console.log('Info.plist OK para release: sin ATS de desarrollo y con número de build dinámico.')
