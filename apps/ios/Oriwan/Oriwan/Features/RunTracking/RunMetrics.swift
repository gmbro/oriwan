import Foundation

struct RunMetrics {
    var elapsedTime: TimeInterval = 0
    var distanceMeters: Double = 0
    var currentSpeedMetersPerSecond: Double = 0
    var averageHeartRate: Double?
    var currentCadenceStepsPerMinute: Double?
    var elevationGainMeters: Double = 0

    var distanceText: String {
        String(format: "%.2f", distanceMeters / 1000)
    }

    var averagePaceText: String {
        guard distanceMeters > 0 else { return "--'--\"" }
        return (elapsedTime / (distanceMeters / 1000)).formattedPace
    }

    var speedText: String {
        String(format: "%.1f", currentSpeedMetersPerSecond * 3.6)
    }

    var cadenceText: String {
        guard let currentCadenceStepsPerMinute else { return "--" }
        return String(format: "%.0f", currentCadenceStepsPerMinute)
    }

    var heartRateText: String {
        guard let averageHeartRate else { return "--" }
        return String(format: "%.0f", averageHeartRate)
    }

    var elevationText: String {
        String(format: "%.0f", elevationGainMeters)
    }

    var statusText: String {
        if distanceMeters <= 0 {
            return "GPS 신호를 잡는 중이에요"
        }
        return "\(distanceText)km를 \(averagePaceText)/km 페이스로 달리는 중"
    }
}

extension TimeInterval {
    var formattedDuration: String {
        let totalSeconds = Int(self.rounded())
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }

        return String(format: "%02d:%02d", minutes, seconds)
    }

    var formattedPace: String {
        guard isFinite, self > 0 else { return "--'--\"" }
        let minutes = Int(self) / 60
        let seconds = Int(self) % 60
        return String(format: "%d'%02d\"", minutes, seconds)
    }
}
