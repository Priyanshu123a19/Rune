'use client'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { createCheckoutSession } from '@/lib/stripe'
import { api } from '@/trpc/react'
import { CreditCard, Info, Sparkles, Zap, FileCode, MessageSquare } from 'lucide-react'
import React from 'react'

const BillingPage = () => {
    const { data: user } = api.project.getMyCredits.useQuery()
    const [creditsToBuy, setCreditsToBuy] = React.useState<number[]>([100])
    const creditsToBuyAmount = creditsToBuy[0]!

    const USD_TO_INR  = 83
    const priceUSD    = creditsToBuyAmount / 50
    const priceINR    = (priceUSD * USD_TO_INR).toFixed(0)

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-8">

            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="size-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
                </div>
                <p className="text-sm text-gray-500">Purchase Runes to index repositories and use AI features.</p>
            </div>

            {/* Current balance */}
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide mb-1">Current Balance</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-primary">{user?.credits ?? 0}</span>
                            <span className="text-sm text-primary/60 mb-1">Runes</span>
                        </div>
                    </div>
                    <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-7 text-primary/70" />
                    </div>
                </div>
            </div>

            {/* What are Runes */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Info className="size-4 text-blue-600 shrink-0" />
                    <p className="text-sm font-semibold text-blue-700">What are Runes?</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { icon: <FileCode className="size-4 text-blue-500" />, label: '1 Rune = 1 file indexed', desc: 'Index any file in your repository' },
                        { icon: <MessageSquare className="size-4 text-blue-500" />, label: 'Powers Q&A',            desc: 'Enables AI answers about your code' },
                        { icon: <Zap className="size-4 text-blue-500" />,         label: 'Fuels AI tools',         desc: 'Used by review, bug & test agents' },
                    ].map(({ icon, label, desc }) => (
                        <div key={label} className="flex gap-2 items-start bg-white/60 rounded-lg p-2.5 border border-blue-100">
                            {icon}
                            <div>
                                <p className="text-xs font-semibold text-blue-700">{label}</p>
                                <p className="text-xs text-blue-500">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Purchase card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <h2 className="text-sm font-semibold text-gray-700">Purchase Runes</h2>

                {/* Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-bold text-gray-800 tabular-nums">{creditsToBuyAmount} Runes</span>
                    </div>
                    <Slider
                        defaultValue={[100]}
                        max={1000}
                        min={10}
                        step={10}
                        value={creditsToBuy}
                        onValueChange={v => setCreditsToBuy(v)}
                        className="accent-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>10</span>
                        <span>1,000</span>
                    </div>
                </div>

                {/* Price breakdown */}
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Total price for {creditsToBuyAmount} Runes</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">₹{priceINR}</span>
                            <span className="text-sm text-gray-400">≈ ${priceUSD.toFixed(2)} USD</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">₹{(Number(priceINR) / creditsToBuyAmount).toFixed(2)} per Rune</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Exchange rate</p>
                        <p className="text-xs font-medium text-gray-500">1 USD = ₹{USD_TO_INR}</p>
                    </div>
                </div>

                <Button
                    className="w-full gap-2"
                    onClick={() => createCheckoutSession(creditsToBuyAmount)}
                >
                    <Sparkles className="size-4" />
                    Buy {creditsToBuyAmount} Runes for ₹{priceINR}
                </Button>

                <p className="text-xs text-center text-gray-400">
                    Secure checkout · Exchange rate is approximate
                </p>
            </div>
        </div>
    )
}

export default BillingPage
