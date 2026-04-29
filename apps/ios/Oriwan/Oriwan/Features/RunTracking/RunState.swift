import Foundation

enum RunState {
    case idle
    case running
    case paused
    case finished

    var title: String {
        switch self {
        case .idle:
            "오늘의 러닝을 시작해요"
        case .running:
            "러닝 기록 중"
        case .paused:
            "잠시 멈춤"
        case .finished:
            "러닝 저장 완료"
        }
    }

    var primaryButtonTitle: String {
        switch self {
        case .idle, .finished:
            "러닝 시작"
        case .running:
            "일시정지"
        case .paused:
            "다시 시작"
        }
    }

    var canFinish: Bool {
        self == .running || self == .paused
    }
}
