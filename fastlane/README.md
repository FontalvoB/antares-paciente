fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios check

```sh
[bundle exec] fastlane ios check
```

Validaciones rápidas: lint, tests, i18n y guardas de release (Info.plist)

### ios signing

```sh
[bundle exec] fastlane ios signing
```

Crea o renueva el certificado 'Apple Distribution' y el profile App Store en el repo de Match

### ios build

```sh
[bundle exec] fastlane ios build
```

Compila, archiva y exporta el IPA firmado SIN subirlo a TestFlight

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Flujo completo: build web + sync + firma + archive + IPA + upload a TestFlight

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
