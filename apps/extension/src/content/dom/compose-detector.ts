import { DOM_SELECTORS } from './selectors';

function findComposeBox(): HTMLElement | null {
  const focused = document.activeElement?.closest<HTMLElement>(DOM_SELECTORS.COMPOSE_TEXTAREA);
  if (focused) {
    return focused;
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>(DOM_SELECTORS.COMPOSE_TEXTAREA));
  // A composer inside the reply modal outranks an inline one when both exist.
  return all.find((el) => el.closest(DOM_SELECTORS.DIALOG)) ?? all[0] ?? null;
}

/**
 * Resolve which tweet the composer is replying to.
 *
 * X arranges the composer two different ways:
 *  - Reply modal: the composer and the tweet being replied to share a
 *    `role="dialog"` ancestor.
 *  - Permalink and feed: the composer sits inline as a sibling of the tweet
 *    inside the same virtualised timeline cell, and there is no dialog on the
 *    page at all.
 *
 * Requiring a dialog therefore drops every reply started from a post page.
 */
function findTargetTweet(composeBox: HTMLElement): Element | null {
  const dialog = composeBox.closest(DOM_SELECTORS.DIALOG);
  if (dialog) {
    const inDialog = dialog.querySelector(DOM_SELECTORS.TWEET_ARTICLE);
    if (inDialog) {
      return inDialog;
    }
  }

  const inCell = composeBox
    .closest(DOM_SELECTORS.TIMELINE_CELL)
    ?.querySelector(DOM_SELECTORS.TWEET_ARTICLE);
  if (inCell) {
    return inCell;
  }

  // Last resort: on a permalink the first tweet in the main column is the root post.
  return (
    document.querySelector(DOM_SELECTORS.PRIMARY_COLUMN)?.querySelector(DOM_SELECTORS.TWEET_ARTICLE) ??
    null
  );
}

export function detectReplyTarget(): string | null {
  const composeBox = findComposeBox();
  if (!composeBox) {
    return null;
  }

  const tweet = findTargetTweet(composeBox);
  if (!tweet) {
    return null;
  }

  const tweetText = tweet.querySelector<HTMLElement>(DOM_SELECTORS.TWEET_TEXT);
  const text = tweetText?.innerText.trim();
  return text ? text : null;
}
