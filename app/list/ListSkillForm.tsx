'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORIES } from '@/lib/placeholder-data'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { createSkill } from '@/app/actions/skills'

const STEPS = ['Basic Info', 'Pricing', 'Integration', 'Preview']

export default function ListSkillForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', description: '', category: '', pricingModel: 'per_use', price: '', apiEndpoint: '', docs: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ skillId: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const validateCurrentStep = (): string | null => {
    if (step === 0) {
      if (!form.name.trim()) return 'Skill name is required.'
      if (!form.category) return 'Please select a category.'
    }
    if (step === 1) {
      const price = parseFloat(form.price)
      if (!form.price || isNaN(price) || price <= 0) return 'Price must be greater than 0.'
    }
    return null
  }

  const handleContinue = () => {
    const validationError = validateCurrentStep()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setStep(s => Math.min(3, s + 1))
  }

  const handleSubmit = () => {
    setError(null)
    // Final validation
    if (!form.name.trim()) { setError('Skill name is required.'); return }
    if (!form.category) { setError('Please select a category.'); return }
    const price = parseFloat(form.price)
    if (!form.price || isNaN(price) || price <= 0) { setError('Price must be greater than 0.'); return }

    startTransition(async () => {
      const result = await createSkill(form)
      if (result.success && result.skillId) {
        setSuccess({ skillId: result.skillId })
      } else {
        setError(result.error || 'Something went wrong. Please try again.')
      }
    })
  }

  if (success) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Skill Listed!</h1>
          <p className="text-[#8892a4] mb-8">Your skill has been submitted and is now live on the marketplace.</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Go to Dashboard
            </Button>
            <Button
              onClick={() => router.push(`/skill/${success.skillId}`)}
              variant="outline"
              className="border-[#1e2535] text-[#8892a4] hover:text-white"
            >
              View Skill
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">List a Skill</h1>
        <p className="text-[#8892a4] mb-8">Publish your agent&apos;s capabilities to the A2A Colony marketplace</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => i <= step && setStep(i)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  i === step ? 'text-white' : i < step ? 'text-blue-400' : 'text-[#8892a4]'
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                    i === step ? 'border-blue-500 text-blue-500' : 'border-[#1e2535] text-[#8892a4]'
                  }`}>
                    {i + 1}
                  </div>
                )}
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-[#1e2535] w-8" />}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Skill Name <span className="text-red-400">*</span></label>
                <Input
                  placeholder="e.g. Deep Web Research Agent"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe what your skill does, what inputs it accepts, and what it returns..."
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  className="w-full bg-[#07090f] border border-[#1e2535] rounded-md text-white placeholder:text-[#8892a4] text-sm p-3 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Category <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => update('category', cat.id)}
                      className={`p-3 rounded-lg border text-sm transition-all ${
                        form.category === cat.id
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-[#1e2535] text-[#8892a4] hover:text-white hover:border-[#2e3545]'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-3">Pricing Model</label>
                <div className="space-y-3">
                  {[
                    { id: 'per_use', label: 'Pay per use', desc: 'Buyers pay each time they call your skill' },
                    { id: 'subscription', label: 'Monthly subscription', desc: 'Recurring monthly fee for unlimited access' },
                    { id: 'one_time', label: 'One-time purchase', desc: 'Permanent access for a single payment' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => update('pricingModel', opt.id)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        form.pricingModel === opt.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-[#1e2535] hover:border-[#2e3545]'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{opt.label}</div>
                      <div className="text-xs text-[#8892a4] mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Price (GBP £) <span className="text-red-400">*</span></label>
                <Input
                  type="number"
                  placeholder="e.g. 0.50"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={e => update('price', e.target.value)}
                  className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4]"
                />
                <p className="text-xs text-[#8892a4] mt-1">Platform takes 10%. You receive 90%.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">API Endpoint</label>
                <Input
                  placeholder="https://your-agent.com/api/invoke"
                  value={form.apiEndpoint}
                  onChange={e => update('apiEndpoint', e.target.value)}
                  className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4] font-mono text-sm"
                />
                <p className="text-xs text-[#8892a4] mt-1">Must accept POST requests with JSON body. We&apos;ll health-check this hourly.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Documentation (Markdown)</label>
                <textarea
                  rows={6}
                  placeholder={`## Input\n\n\`\`\`json\n{ "input": "string" }\n\`\`\`\n\n## Output\n\n\`\`\`json\n{ "output": "string", "sources": [] }\n\`\`\``}
                  value={form.docs}
                  onChange={e => update('docs', e.target.value)}
                  className="w-full bg-[#07090f] border border-[#1e2535] rounded-md text-white placeholder:text-[#8892a4] text-sm p-3 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-14 h-14 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Ready to publish?</h3>
              <p className="text-[#8892a4] text-sm mb-6">Your skill will be live immediately on the marketplace.</p>
              <div className="bg-[#07090f] border border-[#1e2535] rounded-lg p-4 text-left mb-6 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-[#8892a4]">Skill name</span><span className="text-white">{form.name || 'Not set'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#8892a4]">Category</span><span className="text-white capitalize">{form.category || 'Not set'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#8892a4]">Pricing</span><span className="text-white">£{form.price} {form.pricingModel}</span></div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-blue-500 hover:bg-blue-600 text-white w-full h-11 disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex justify-between mt-4">
            <Button
              variant="ghost"
              onClick={() => { setError(null); setStep(s => Math.max(0, s - 1)) }}
              disabled={step === 0}
              className="text-[#8892a4] hover:text-white"
            >
              Back
            </Button>
            <Button
              onClick={handleContinue}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
