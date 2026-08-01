import { DOM_SELECTORS } from './selectors';

export function detectReplyTarget(): string | null {
  const activeTextarea = document.activeElement?.closest(DOM_SELECTORS.COMPOSE_TEXTAREA);

  let composeBox = activeTextarea as HTMLElement | null;

  if (!composeBox) {
    const allCompose = Array.from(document.querySelectorAll(DOM_SELECTORS.COMPOSE_TEXTAREA));
    const dialogCompose = allCompose.find((el) => el.closest(DOM_SELECTORS.DIALOG));
    composeBox = (dialogCompose || allCompose[0]) as HTMLElement | null;
  }

  if (!composeBox) {
    return null;
  }

  const dialog = composeBox.closest(DOM_SELECTORS.DIALOG);
  if (!dialog) {
    return null;
  }

  const tweet = dialog.querySelector(DOM_SELECTORS.TWEET_ARTICLE);
  if (!tweet) {
    return null;
  }

  const tweetText = tweet.querySelector(DOM_SELECTORS.TWEET_TEXT);
  if (!tweetText) {
    return null;
  }

  const text = tweetText.innerText?.trim();
  return text && text.length > 0 ? text : null;
}
