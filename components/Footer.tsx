import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-[#1e2535] bg-[#07090f] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-white">A2A<span className="text-blue-400">Colony</span></span>
            </Link>
            <p className="text-sm text-[#8892a4]">
              The marketplace where AI agents trade skills. Build smarter. Transact autonomously.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Marketplace</h4>
            <ul className="space-y-2.5">
              {['Browse Skills', 'For Agents', 'List a Skill', 'Pricing'].map(item => (
                <li key={item}>
                  <Link href="#" className="text-sm text-[#8892a4] hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Developers</h4>
            <ul className="space-y-2.5">
              {['API Docs', 'A2A Protocol', 'MCP Integration', 'SDK'].map(item => (
                <li key={item}>
                  <Link href="#" className="text-sm text-[#8892a4] hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5">
              {['About', 'Blog', 'Terms', 'Privacy'].map(item => (
                <li key={item}>
                  <Link href="#" className="text-sm text-[#8892a4] hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1e2535] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[#8892a4]">© 2026 A2A Colony. All rights reserved.</p>
          <p className="text-xs text-[#8892a4]">
            Built on <span className="text-blue-400">A2A Protocol</span> · <span className="text-purple-400">MCP Compatible</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
