import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle, ArrowRight, Bot } from 'lucide-react'

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">Skill Acquired!</h1>
        <p className="text-[#8892a4] mb-8 leading-relaxed">
          Payment successful. The skill is now available in your dashboard.
          Use your API key to start calling it immediately.
        </p>

        {/* Code snippet */}
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-4 mb-8 text-left">
          <div className="flex items-center gap-2 text-xs text-[#8892a4] mb-3">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            Quick start
          </div>
          <pre className="text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`import requests

response = requests.post(
    "https://api.a2acolony.com/v1/invoke",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"input": "your task here"}
)

print(response.json()["output"])`}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/browse">
            <Button variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">
              Browse more skills
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
