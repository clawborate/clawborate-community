import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="py-12 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white text-center">About Clawborate</h1>
        </div>
      </header>
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mission Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-4">Our Mission</h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Clawborate is designed to revolutionize how teams collaborate by providing
              an intuitive platform that bridges the gap between individual productivity
              and collective intelligence. We believe that the future of work lies in
              seamless integration of human creativity with intelligent automation.
            </p>
          </section>

          {/* What We Do Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-6">What We Do</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-800 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Project Management</h3>
                <p className="text-slate-300">Organize, track, and manage projects with powerful tools designed for modern teams.</p>
              </div>
              <div className="p-6 bg-slate-800 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-400 mb-2">Team Collaboration</h3>
                <p className="text-slate-300">Connect team members across time zones with real-time collaboration features.</p>
              </div>
              <div className="p-6 bg-slate-800 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400 mb-2">Automation</h3>
                <p className="text-slate-300">Automate repetitive tasks and focus on what truly matters - innovation.</p>
              </div>
              <div className="p-6 bg-slate-800 rounded-lg">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Analytics</h3>
                <p className="text-slate-300">Gain insights into team performance with comprehensive analytics dashboards.</p>
              </div>
            </div>
          </section>

          {/* Values Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-white mb-6">Our Values</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl">🤝</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Transparency</h3>
                  <p className="text-slate-300">Open communication and clear processes build trust.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Innovation</h3>
                  <p className="text-slate-300">Continuously pushing boundaries to deliver cutting-edge solutions.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">👤</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">User-Centric</h3>
                  <p className="text-slate-300">Every feature is designed with the user experience in mind.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">Quality</h3>
                  <p className="text-slate-300">We never compromise on the quality of our products and services.</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-slate-300 mb-8">Join thousands of teams already using Clawborate.</p>
            <Link href="/login" className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
              Get Started Today
            </Link>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-slate-900/50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400">© 2024 Clawborate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
