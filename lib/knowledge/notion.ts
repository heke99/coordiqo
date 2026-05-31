export type NotionKnowledgeConfig = {
  notionApiKey: string | null
  notionWorkspaceId: string | null
}

export function getNotionKnowledgeConfig(): NotionKnowledgeConfig {
  return {
    notionApiKey: process.env.NOTION_API_KEY ?? null,
    notionWorkspaceId: process.env.NOTION_WORKSPACE_ID ?? null,
  }
}

export function isNotionConfigured() {
  const config = getNotionKnowledgeConfig()
  return Boolean(config.notionApiKey)
}

