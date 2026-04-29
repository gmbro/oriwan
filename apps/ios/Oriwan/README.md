# Oriwan iOS Native App

This directory starts the native iOS transition for NRC-style run tracking.

The current Next.js app remains useful for landing, auth, backend routes, and recovery experiences. The iOS app owns the parts that a web app cannot do reliably:

- Background GPS run tracking
- HealthKit workout save/read
- Apple Health permission UX
- Cadence estimation through Core Motion
- Lock-screen/live workout experiences in later iterations

## Xcode Setup

1. Create a new iOS App project in Xcode named `Oriwan`.
2. Set the bundle identifier, for example `com.oriwan.app`.
3. Add the Swift files from `Oriwan/` to the app target.
4. Replace the generated `Info.plist` values with the keys in `Oriwan/Info.plist`.
5. Add the entitlements in `Oriwan/Oriwan.entitlements`.
6. In Signing & Capabilities, enable:
   - HealthKit
   - Background Modes > Location updates
7. Run on a physical iPhone. HealthKit and background location behavior should not be trusted from simulator-only testing.

## First Native Milestone

- Start/pause/resume/finish an outdoor run.
- Track elapsed time, distance, current pace, average pace, speed, route, heart rate when available, and cadence when available.
- Save the run as an `HKWorkout` with route data in Apple Health.
- Keep enough normalized data to sync the run to Oriwan backend after completion.

## Important Product Boundary

iPhone-only users can record distance/time/pace/speed/GPS route. Heart rate requires Apple Watch or an external heart-rate sensor. Cadence from `CMPedometer` is available only when the device can provide pedometer updates, and it should be treated as optional.
