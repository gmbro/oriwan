import CoreLocation
import Foundation
import HealthKit

final class HealthKitWorkoutStore: NSObject {
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var routeBuilder: HKWorkoutRouteBuilder?

    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestAuthorization() async throws {
        guard isHealthDataAvailable else { return }

        let workoutType = HKObjectType.workoutType()
        let routeType = HKSeriesType.workoutRoute()
        let quantityTypes: [HKQuantityType] = [
            .quantityType(forIdentifier: .distanceWalkingRunning),
            .quantityType(forIdentifier: .heartRate),
            .quantityType(forIdentifier: .activeEnergyBurned),
            .quantityType(forIdentifier: .stepCount),
        ].compactMap { $0 }

        var typesToShare = Set<HKSampleType>([workoutType, routeType])
        quantityTypes.forEach { typesToShare.insert($0) }

        var typesToRead = Set<HKObjectType>([workoutType, routeType])
        quantityTypes.forEach { typesToRead.insert($0) }

        try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
    }

    func startWorkout(at startDate: Date) throws {
        guard isHealthDataAvailable else { return }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .running
        configuration.locationType = .outdoor

        let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)

        self.session = session
        self.builder = builder
        self.routeBuilder = HKWorkoutRouteBuilder(healthStore: healthStore, device: .local())

        session.startActivity(with: startDate)
        builder.beginCollection(withStart: startDate) { _, error in
            if let error {
                assertionFailure("HealthKit collection failed to start: \(error.localizedDescription)")
            }
        }
    }

    func pauseWorkout() {
        session?.pause()
    }

    func resumeWorkout() {
        session?.resume()
    }

    func addRouteLocations(_ locations: [CLLocation]) {
        guard !locations.isEmpty else { return }

        routeBuilder?.insertRouteData(locations) { success, error in
            if let error {
                assertionFailure("HealthKit route insert failed: \(error.localizedDescription)")
            }
            assert(success || error != nil)
        }
    }

    func finishWorkout(at endDate: Date) async throws -> HKWorkout? {
        guard let session, let builder else { return nil }

        session.stopActivity(with: endDate)
        session.end()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            builder.endCollection(withEnd: endDate) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: HealthKitWorkoutError.finishFailed)
                }
            }
        }

        let workout = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HKWorkout, Error>) in
            builder.finishWorkout { workout, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let workout {
                    continuation.resume(returning: workout)
                } else {
                    continuation.resume(throwing: HealthKitWorkoutError.finishFailed)
                }
            }
        }

        try await finishRouteIfNeeded(for: workout)

        self.session = nil
        self.builder = nil
        self.routeBuilder = nil

        return workout
    }

    func latestAverageHeartRate() -> Double? {
        guard let builder,
              let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate),
              let statistics = builder.statistics(for: heartRateType),
              let quantity = statistics.averageQuantity()
        else {
            return nil
        }

        return quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
    }

    private func finishRouteIfNeeded(for workout: HKWorkout) async throws {
        guard let routeBuilder else { return }

        _ = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HKWorkoutRoute?, Error>) in
            routeBuilder.finishRoute(with: workout, metadata: nil) { route, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: route)
                }
            }
        }
    }
}

enum HealthKitWorkoutError: Error {
    case finishFailed
}
