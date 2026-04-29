import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var runTracker: RunTracker

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 0.92, green: 0.97, blue: 1.0), Color(red: 1.0, green: 0.96, blue: 0.89)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 24) {
                    header
                    metricGrid
                    controls
                    permissionHint
                }
                .padding(20)
            }
            .navigationTitle("오리완 러닝")
            .task {
                await runTracker.requestPermissionsIfNeeded()
            }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Text(runTracker.state.title)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)

            Text(runTracker.metrics.elapsedTime.formattedDuration)
                .font(.system(size: 58, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.primary)

            Text(runTracker.metrics.statusText)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private var metricGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
            MetricCard(title: "거리", value: runTracker.metrics.distanceText, caption: "km")
            MetricCard(title: "평균 페이스", value: runTracker.metrics.averagePaceText, caption: "/km")
            MetricCard(title: "현재 속도", value: runTracker.metrics.speedText, caption: "km/h")
            MetricCard(title: "케이던스", value: runTracker.metrics.cadenceText, caption: "spm")
            MetricCard(title: "심박수", value: runTracker.metrics.heartRateText, caption: "bpm")
            MetricCard(title: "고도 상승", value: runTracker.metrics.elevationText, caption: "m")
        }
    }

    private var controls: some View {
        VStack(spacing: 12) {
            Button(action: primaryAction) {
                Text(runTracker.state.primaryButtonTitle)
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)

            if runTracker.state.canFinish {
                Button("러닝 종료하고 건강앱에 저장") {
                    Task { await runTracker.finishRun() }
                }
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.red)
            }
        }
    }

    private var permissionHint: some View {
        Text("백그라운드 측정을 위해 위치 권한은 항상 허용, 건강 데이터는 읽기/쓰기를 허용해주세요.")
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 12)
    }

    private func primaryAction() {
        Task {
            switch runTracker.state {
            case .idle, .finished:
                await runTracker.startRun()
            case .running:
                runTracker.pauseRun()
            case .paused:
                runTracker.resumeRun()
            }
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .monospacedDigit()
                Text(caption)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
