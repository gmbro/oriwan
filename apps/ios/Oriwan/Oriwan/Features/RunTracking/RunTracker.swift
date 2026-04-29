import CoreLocation
import CoreMotion
import Foundation
import HealthKit

@MainActor
final class RunTracker: NSObject, ObservableObject {
    @Published private(set) var state: RunState = .idle
    @Published private(set) var metrics = RunMetrics()

    private let healthKitStore = HealthKitWorkoutStore()
    private let locationManager = CLLocationManager()
    private let pedometer = CMPedometer()

    private var startDate: Date?
    private var pauseDate: Date?
    private var accumulatedPauseDuration: TimeInterval = 0
    private var lastLocation: CLLocation?
    private var lastAltitude: CLLocationDistance?
    private var timer: Timer?
    private var routeBuffer: [CLLocation] = []

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.activityType = .fitness
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 5
        locationManager.pausesLocationUpdatesAutomatically = false
    }

    func requestPermissionsIfNeeded() async {
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestAlwaysAuthorization()

        do {
            try await healthKitStore.requestAuthorization()
        } catch {
            assertionFailure("HealthKit authorization failed: \(error.localizedDescription)")
        }
    }

    func startRun() async {
        await requestPermissionsIfNeeded()

        metrics = RunMetrics()
        state = .running
        startDate = Date()
        pauseDate = nil
        accumulatedPauseDuration = 0
        lastLocation = nil
        lastAltitude = nil
        routeBuffer.removeAll()

        do {
            try healthKitStore.startWorkout(at: startDate ?? Date())
        } catch {
            assertionFailure("HealthKit workout failed to start: \(error.localizedDescription)")
        }

        startLocationTracking()
        startCadenceTracking()
        startTimer()
    }

    func pauseRun() {
        guard state == .running else { return }
        state = .paused
        pauseDate = Date()
        locationManager.stopUpdatingLocation()
        pedometer.stopUpdates()
        healthKitStore.pauseWorkout()
        timer?.invalidate()
    }

    func resumeRun() {
        guard state == .paused else { return }
        if let pauseDate {
            accumulatedPauseDuration += Date().timeIntervalSince(pauseDate)
        }
        pauseDate = nil
        state = .running
        startLocationTracking()
        startCadenceTracking()
        healthKitStore.resumeWorkout()
        startTimer()
    }

    func finishRun() async {
        guard state == .running || state == .paused else { return }

        state = .finished
        locationManager.stopUpdatingLocation()
        pedometer.stopUpdates()
        timer?.invalidate()
        flushRouteBuffer()

        do {
            _ = try await healthKitStore.finishWorkout(at: Date())
        } catch {
            assertionFailure("HealthKit workout failed to finish: \(error.localizedDescription)")
        }
    }

    private func startLocationTracking() {
        if CLLocationManager.locationServicesEnabled() {
            locationManager.allowsBackgroundLocationUpdates = true
            locationManager.showsBackgroundLocationIndicator = true
            locationManager.startUpdatingLocation()
        }
    }

    private func startCadenceTracking() {
        guard CMPedometer.isCadenceAvailable(), let startDate else { return }

        pedometer.startUpdates(from: startDate) { [weak self] data, _ in
            guard let self, let cadence = data?.currentCadence else { return }

            Task { @MainActor in
                self.metrics.currentCadenceStepsPerMinute = cadence.doubleValue * 60
            }
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tick()
            }
        }
    }

    private func tick() {
        guard state == .running, let startDate else { return }
        metrics.elapsedTime = Date().timeIntervalSince(startDate) - accumulatedPauseDuration
        metrics.averageHeartRate = healthKitStore.latestAverageHeartRate()
    }

    private func appendLocation(_ location: CLLocation) {
        guard state == .running else { return }
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 25 else { return }

        routeBuffer.append(location)

        if let lastLocation {
            let segmentDistance = location.distance(from: lastLocation)
            if segmentDistance >= 1 {
                metrics.distanceMeters += segmentDistance
            }
        }

        if location.speed >= 0 {
            metrics.currentSpeedMetersPerSecond = location.speed
        }

        if let lastAltitude {
            let gain = location.altitude - lastAltitude
            if gain > 0 {
                metrics.elevationGainMeters += gain
            }
        }

        lastLocation = location
        lastAltitude = location.altitude

        if routeBuffer.count >= 20 {
            flushRouteBuffer()
        }
    }

    private func flushRouteBuffer() {
        guard !routeBuffer.isEmpty else { return }
        healthKitStore.addRouteLocations(routeBuffer)
        routeBuffer.removeAll()
    }
}

extension RunTracker: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            locations.forEach { self.appendLocation($0) }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
                self.locationManager.allowsBackgroundLocationUpdates = true
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        assertionFailure("Location tracking failed: \(error.localizedDescription)")
    }
}
