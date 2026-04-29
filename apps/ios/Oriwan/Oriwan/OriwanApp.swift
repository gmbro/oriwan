import SwiftUI

@main
struct OriwanApp: App {
    @StateObject private var runTracker = RunTracker()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(runTracker)
        }
    }
}
