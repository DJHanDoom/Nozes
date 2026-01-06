/**
 * Model Configuration - Actual API Model Names
 * Centralized configuration for all supported AI models and providers
 */

import { ModelOption, AIProvider, ProviderConfig } from '../types';

// All available models - using ACTUAL API model IDs
export const AVAILABLE_MODELS: ModelOption[] = [
    // ═══════════════════════════════════════════════════════════════════════════
    // GEMINI MODELS (Google - Actual API names from generativelanguage.googleapis.com)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'gemini-1.5-flash-002',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        description: 'Fast & cost-effective (stable)',
        contextWindow: 1000000
    },
    {
        id: 'gemini-1.5-pro-002',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        description: 'Powerful for complex reasoning',
        contextWindow: 1000000
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Exp',
        provider: 'gemini',
        description: 'Latest 2.0 experimental model',
        contextWindow: 1000000
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        description: 'Fast & reliable (confirmed working)',
        contextWindow: 1000000,
        isRecommended: true
    },
    {
        id: 'gemini-3.0-pro',
        name: 'Gemini 3.0 Pro',
        provider: 'gemini',
        description: 'Most powerful Gemini model',
        contextWindow: 1000000
    },
    {
        id: 'gemini-3.0-flash',
        name: 'Gemini 3.0 Flash',
        provider: 'gemini',
        description: 'Latest & fastest Gemini 3',
        contextWindow: 1000000
    },
    {
        id: 'gemini-exp-1206',
        name: 'Gemini Exp 1206',
        provider: 'gemini',
        description: 'December experimental',
        contextWindow: 1000000
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // OPENAI MODELS (Actual API names from api.openai.com)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: 'Most capable multimodal model',
        isRecommended: true
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        description: 'Fast & cost-effective'
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        description: 'High performance GPT-4'
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        description: 'Legacy, low-cost option'
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        provider: 'openai',
        description: 'Reasoning model for math & code'
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // CLAUDE MODELS (Anthropic - Actual API names from api.anthropic.com)
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'claude',
        description: 'Best overall Claude model',
        contextWindow: 200000,
        isRecommended: true
    },
    {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'claude',
        description: 'Fast & cost-efficient',
        contextWindow: 200000
    },
    {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'claude',
        description: 'Most intelligent Claude 3',
        contextWindow: 200000
    },
    {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: 'claude',
        description: 'Balanced performance',
        contextWindow: 200000
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // HUGGINGFACE MODELS (Open Source via Inference API)
    // Note: These require a backend proxy due to CORS restrictions
    // ═══════════════════════════════════════════════════════════════════════════
    {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        name: 'Llama 3.3 70B',
        provider: 'huggingface',
        description: 'Meta - 128K context (via API)',
        contextWindow: 128000,
        isRecommended: true
    },
    {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        provider: 'huggingface',
        description: 'Mistral MoE (via API)'
    },
    {
        id: 'google/gemma-2-27b-it',
        name: 'Gemma 2 27B',
        provider: 'huggingface',
        description: 'Google open model (via API)'
    }
];

// Provider information and API key URLs
export const PROVIDER_INFO: Record<AIProvider, ProviderConfig> = {
    gemini: {
        name: 'Google Gemini',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        icon: '🔷'
    },
    openai: {
        name: 'OpenAI',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        icon: '🤖'
    },
    claude: {
        name: 'Anthropic Claude',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        icon: '🧠'
    },
    huggingface: {
        name: 'HuggingFace',
        apiKeyUrl: 'https://huggingface.co/settings/tokens',
        icon: '🤗'
    }
};

// Helper functions
export const getModelsByProvider = (provider: AIProvider): ModelOption[] => {
    return AVAILABLE_MODELS.filter(m => m.provider === provider);
};

export const getModelInfo = (modelId: string): ModelOption | undefined => {
    return AVAILABLE_MODELS.find(m => m.id === modelId);
};

export const getProviderFromModel = (modelId: string): AIProvider => {
    const model = getModelInfo(modelId);
    return model?.provider || 'gemini';
};

export const getDefaultModelForProvider = (provider: AIProvider): string => {
    const models = getModelsByProvider(provider);
    const recommended = models.find(m => m.isRecommended);
    return recommended?.id || models[0]?.id || 'gemini-1.5-flash-002';
};

export const formatContextWindow = (tokens?: number): string => {
    if (!tokens) return '';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
    return `${(tokens / 1000).toFixed(0)}K`;
};
