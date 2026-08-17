# Building this app

`eas.json` cannot carry comments — EAS validates every key under `build` as a
profile — so the two things worth knowing about these profiles live here.

## Use `development` for anything involving the paywall

```
eas build --profile development --platform android
npx expo start --dev-client
```

RevenueCat's Test Store deliberately refuses to run in a release build: it shows
an alert and crashes, rather than let test purchases grant real entitlements.
`preview` and `production` are release builds, so neither can show the paywall
until real App Store / Play keys exist in `app.json`.

The development profile also keeps `__DEV__` true, which is what
`src/lib/purchases.js` requires before it will reach for the test key at all. In
any other profile it configures nothing and everybody is simply not Pro — by
design, so a shipped build cannot carry a test key.

## Expo Go will not work

`react-native-purchases` is a native module. Expo Go has a preview mode for
laying out paywalls, but purchases, entitlements and customer info need a real
build.

## `apiUrl` is baked in at build time

`app.json` → `expo.extra.apiUrl` points at the deployed Cloud Run backend.
Without it the host is derived from whatever machine is serving Metro, which
works at a desk and nowhere else. Change the backend, rebuild — a running app
will not pick up a new URL.
