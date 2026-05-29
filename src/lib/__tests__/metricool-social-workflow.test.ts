import { describe, expect, it } from 'vitest'
import {
  PROVIDERS,
  buildSchedulePlan,
  buildSplitDefinition,
  createDefaultCaptions,
  type SocialVideoItem,
} from '@/lib/metricool-social-workflow'

function item(overrides: Partial<SocialVideoItem> = {}): SocialVideoItem {
  const base = {
    id: 'bellara-brass:signature-shorts:01-two-reverse-tuning-slides',
    business: 'bellara-brass',
    campaign: 'signature-shorts',
    campaignName: 'Bellara Signature Shorts',
    modelName: 'Signature Model',
    productUrl: 'https://bellarabrass.com/products/signature-model',
    feature: 'Two reverse tuning slides',
    position: 1,
    mediaUrl: 'https://bellarabrass.com/metricool-media/signature-shorts-2026-05-22/bellara-signature-short-01-two-reverse-tuning-slides.mp4',
    fileName: 'bellara-signature-short-01-two-reverse-tuning-slides.mp4',
    autolistId: 500974,
    autolistName: 'Bellara Signature Shorts - Holding Bin',
    autolistPostId: 19332821,
    sourcePath: 'C:\\sources\\signature.json',
    status: 'approved',
    captions: createDefaultCaptions({
      campaign: 'signature-shorts',
      modelName: 'Signature Model',
      feature: 'Two reverse tuning slides',
      productUrl: 'https://bellarabrass.com/products/signature-model',
    }),
    draftIds: {},
    scheduledPosts: {},
  } satisfies SocialVideoItem
  return { ...base, ...overrides }
}

describe('metricool social workflow helpers', () => {
  it('creates platform-specific Bellara captions with first comments only where supported', () => {
    const captions = createDefaultCaptions({
      campaign: 'signature-shorts',
      modelName: 'Signature Model',
      feature: 'Two reverse tuning slides',
      productUrl: 'https://bellarabrass.com/products/signature-model',
    })

    expect(captions.facebook.content).toContain('Two reverse tuning slides')
    expect(captions.facebook.firstCommentText).toBe('https://bellarabrass.com/products/signature-model')
    expect(captions.youtube.title).toBe('Two reverse tuning slides | Bellara Signature Model #Shorts')
    expect(captions.youtube.firstCommentText).toBe('https://bellarabrass.com/products/signature-model')
    expect(captions.instagram.firstCommentText).toBeUndefined()
    expect(captions.tiktok.firstCommentText).toBeUndefined()
  })

  it('builds one first-class Posts Library draft definition per selected network', () => {
    const definition = buildSplitDefinition(item(), ['facebook', 'youtube', 'tiktok'])

    expect(definition.business).toBe('bellara-brass')
    expect(definition.mediaUrl).toContain('bellara-signature-short-01-two-reverse-tuning-slides.mp4')
    expect(definition.posts.map((post) => post.network)).toEqual(['facebook', 'youtube', 'tiktok'])
    expect(definition.posts[0].networkData).toEqual({ type: 'REEL' })
    expect(definition.posts[1].networkData).toMatchObject({
      title: 'Two reverse tuning slides | Bellara Signature Model #Shorts',
      type: 'video',
      madeForKids: false,
    })
    expect(definition.posts[2].firstCommentText).toBe('')
  })

  it('plans approved videos once daily with all selected networks on the same date', () => {
    const plan = buildSchedulePlan([
      item({ id: 'one', campaign: 'artist-shorts', position: 2, feature: 'Custom stone inlays' }),
      item({ id: 'two', campaign: 'artist-shorts', position: 1, feature: 'Artist Model trumpet' }),
      item({ id: 'three', status: 'ready_for_review' }),
    ], {
      campaign: 'artist-shorts',
      startDate: '2026-06-01',
      time: '10:30:00',
      networks: ['instagram', 'youtube'],
    })

    expect(plan).toHaveLength(2)
    expect(plan[0].itemId).toBe('two')
    expect(plan[0].date).toBe('2026-06-01')
    expect(plan[0].posts.map((post) => post.network)).toEqual(['instagram', 'youtube'])
    expect(plan[0].posts.every((post) => post.publicationDate.dateTime === '2026-06-01T10:30:00')).toBe(true)
    expect(plan[1].date).toBe('2026-06-02')
  })

  it('defaults schedule networks to every supported provider', () => {
    const plan = buildSchedulePlan([item()], {
      campaign: 'all',
      startDate: '2026-06-01',
    })

    expect(plan[0].networks).toEqual(PROVIDERS)
  })

  it('rejects invalid schedule dates and times', () => {
    expect(() => buildSchedulePlan([item()], {
      campaign: 'all',
      startDate: '2026-02-31',
    })).toThrow('startDate')

    expect(() => buildSchedulePlan([item()], {
      campaign: 'all',
      startDate: '2026-06-01',
      time: '25:00:00',
    })).toThrow('time')

    expect(() => buildSchedulePlan([item()], {
      campaign: 'all',
      startDate: '2026-06-01',
      networks: ['not-a-network'],
    })).toThrow('network')
  })
})
