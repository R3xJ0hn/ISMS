'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SAFE_PAGEVIEW_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
])

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthogClient = usePostHog()

  useEffect(() => {
    if (pathname && posthogClient) {
      const sanitizedSearchParams = new URLSearchParams()

      searchParams.forEach((value, key) => {
        if (SAFE_PAGEVIEW_QUERY_PARAMS.has(key)) {
          sanitizedSearchParams.append(key, value)
        }
      })

      const sanitizedSearch = sanitizedSearchParams.toString()
      const sanitizedUrl = `${window.origin}${pathname}${
        sanitizedSearch ? `?${sanitizedSearch}` : ''
      }`

      posthogClient.capture('$pageview', { '$current_url': sanitizedUrl })
    }
  }, [pathname, searchParams, posthogClient])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey || !posthogHost) {
      console.warn(
        'PostHog initialization skipped: NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST must both be set.'
      )
      return
    }

    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      capture_heatmaps: true,
      capture_performance: true,
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
