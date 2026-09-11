import { BackLink } from "@/components/BackLink";
const HANDLE = "@ckay";
const X_URL = "https://x.com/CRYPTFRANI";
const MOOVE_URL = "https://www.moove.xyz/@ckay";

export function SiteHeader() {
  return (
    <header className="site-header">
      <BackLink />
      <a className="wordmark" href="/">
        <em>Split</em>pot
      </a>
      <nav className="nav">
        <a href="/connect">Connect</a>
        <a href={MOOVE_URL}>{HANDLE}</a>
        <a href={X_URL} target="_blank" rel="noreferrer">
          X
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p style={{ position: "absolute", left: "-9999px" }}>
        Split any bill. Each person pays in any token on any chain. It settles
        to @ckay on Moove. Built by @ckay
      </p>
      <p>
        Enter the total and the names. Each person gets a pay link. Money goes
        to the host.
      </p>
      <div className="moove-block">
        <h2>What is Moove?</h2>
        <p>
          Moove is software for moving value. You send, receive, and convert
          crypto across chains without asking the payer which network they are
          on. Agentic Payments lets a product create a checkout link; the payer
          uses any token they hold; the money settles to a Moove Handle.
          Splitpot uses that so a group bill becomes one link per person,
          settled to the host on Moove.
        </p>
        <p>
          <a href="https://x.com/moovexyz" target="_blank" rel="noreferrer">
            Moove on X
          </a>
          {" · "}
          <a href="https://www.moove.xyz" target="_blank" rel="noreferrer">
            Use Moove
          </a>
        </p>
      </div>
      <p>
        Built by @ckay
        {" · "}
        <a href={MOOVE_URL}>{HANDLE}</a>
        {" · "}
        <a href={X_URL} target="_blank" rel="noreferrer">
          {X_URL}
        </a>
      </p>
    </footer>
  );
}
