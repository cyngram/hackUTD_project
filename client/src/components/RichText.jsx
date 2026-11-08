// Shows Cosmo's replies with light formatting: **bold**, bullet lists, and paragraphs.
// Builds React elements (no raw HTML), so nothing in a reply can inject code into the page.

function inline(text, keyPrefix) {
  // **bold** and *italic*: split them out, keep everything else as plain text
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).map((piece, i) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={`${keyPrefix}-${i}`}>{piece.slice(2, -2)}</strong>;
    if (piece.length > 2 && piece.startsWith("*") && piece.endsWith("*")) return <em key={`${keyPrefix}-${i}`}>{piece.slice(1, -1)}</em>;
    return piece;
  });
}

export default function RichText({ text }) {
  const blocks = [];
  let bullets = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {bullets.map((b, i) => <li key={i}>{inline(b, `li-${blocks.length}-${i}`)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^([*\-•]|\d+[.)])\s+(.*)$/);   // "* item", "- item", "1. item"
    if (bullet) {
      bullets.push(bullet[2]);
    } else {
      flushBullets();
      if (line) blocks.push(<p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>);
    }
  }
  flushBullets();
  return <>{blocks}</>;
}
