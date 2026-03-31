import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Rune – AI Dev Platform',
        short_name: 'Rune',
        description: 'AI-powered developer platform: code review, bug investigation, sprint planning, and more.',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        orientation: 'portrait',
        icons: [
            {
                src: '/logo.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
        categories: ['developer tools', 'productivity'],
        screenshots: [],
    }
}
