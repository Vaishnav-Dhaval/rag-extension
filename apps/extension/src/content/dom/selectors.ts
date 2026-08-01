export const DOM_SELECTORS = {
  COMPOSE_TEXTAREA: '[data-testid^="tweetTextarea"][contenteditable="true"]',
  DIALOG: 'div[role="dialog"]',
  TWEET_ARTICLE: 'article[data-testid="tweet"]',
  TWEET_TEXT: '[data-testid="tweetText"]',
  /** Virtualised timeline row. Wraps a tweet plus its inline reply composer. */
  TIMELINE_CELL: '[data-testid="cellInnerDiv"]',
  /** Main content column, excludes nav, trends and the sidebar. */
  PRIMARY_COLUMN: '[data-testid="primaryColumn"]',
} as const;
