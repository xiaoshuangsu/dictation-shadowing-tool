"use client"

import Link from "next/link"
import { BookOpen, Check, Crown, Zap, Heart } from "lucide-react"
import { useAuth } from "@/lib/hooks/useAuth"

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth()

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started",
      icon: BookOpen,
      features: [
        "Access to basic materials",
        "Free dictation practice",
        "Free shadowing practice",
        "Learning progress tracking",
      ],
      cta: isAuthenticated ? "Current Plan" : "Get Started",
      ctaLink: isAuthenticated ? "/profile" : "/register",
      highlighted: false,
    },
    {
      name: "Monthly Pro",
      price: "$2.99",
      period: "/month",
      description: "Flexible month-to-month",
      icon: Zap,
      features: [
        "Everything in Free",
        "Unlock all materials (1000+ lessons)",
        "Unlock word translation & lookup",
        "Unlock vocabulary review",
        "Ad-free experience",
        "Priority email support",
      ],
      cta: "Upgrade Now",
      ctaLink: "/register",
      highlighted: false,
    },
    {
      name: "Yearly Pro",
      price: "$19.99",
      period: "/year",
      description: 'Save <span class="text-orange-500 font-bold">44%</span> compared to monthly',
      icon: Crown,
      features: [
        "Everything in Monthly Pro",
        "Unlock all materials (1000+ lessons)",
        "Unlock word translation & lookup",
        "Unlock vocabulary review",
        "Ad-free experience",
        "Priority email support",
      ],
      cta: "Upgrade Now",
      ctaLink: "/register",
      highlighted: true,
      badge: "Best Value",
    },
    {
      name: "Lifetime Pro",
      price: "$89.99",
      period: "once",
      description: "Pay once, own forever",
      icon: Heart,
      features: [
        "Lifetime access to all features",
        "All current and future materials",
        "All current and future features",
        "Ad-free experience forever",
        "Priority support forever",
        "One-time payment, no renewal fees",
      ],
      cta: "Get Lifetime Access",
      ctaLink: "/register",
      highlighted: true,
      badge: "Early Bird Offer",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Master English with <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">ShadowHub</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Choose the plan that fits your journey. Unlock 1000+ premium lessons and accelerate your learning.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => {
            const Icon = plan.icon
            return (
              <div
                key={index}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  plan.highlighted
                    ? "border-2 border-blue-500 ring-4 ring-blue-100 scale-105"
                    : "border border-gray-200"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                    {plan.badge}
                  </div>
                )}

                <div className="p-6">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                    plan.highlighted
                      ? "bg-gradient-to-br from-blue-600 to-purple-600"
                      : "bg-gray-100"
                  }`}>
                    <Icon className={`w-7 h-7 ${
                      plan.highlighted ? "text-white" : "text-gray-600"
                    }`} />
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>

                  {/* Description */}
                  <p
                    className="text-sm text-gray-500 mb-4"
                    dangerouslySetInnerHTML={{ __html: plan.description }}
                  />

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        {plan.price}
                      </span>
                      <span className="text-gray-500">
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link
                    href={plan.ctaLink}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg"
                        : plan.cta === "Current Plan"
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                Can I switch between plans?
              </summary>
              <p className="mt-3 text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, you'll receive credit towards future billing cycles.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                What payment methods do you accept?
              </summary>
              <p className="mt-3 text-gray-600">
                We accept all major credit cards (Visa, MasterCard, American Express) and PayPal. All payments are securely processed through our payment partner.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                Is there a free trial?
              </summary>
              <p className="mt-3 text-gray-600">
                Yes! We offer a 7-day free trial for both Monthly and Yearly Pro plans. You can explore all premium features before committing. No credit card required to start.
              </p>
            </details>

            <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                What's included in the Lifetime Pro plan?
              </summary>
              <p className="mt-3 text-gray-600">
                Lifetime Pro gives you permanent access to all current and future features. This includes all 1000+ lessons, word translation, vocabulary review, and any new features we add. It's a one-time payment with no renewal fees ever.
              </p>
            </details>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Your English Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of learners improving their English with our proven dictation and shadowing method.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/topics"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl"
            >
              Explore Materials
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
