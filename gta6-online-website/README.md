# GTA VI Online Community website

A free, static website for the GTA VI Online Discord community. Uses plain HTML, CSS, and JavaScript. There are no package dependencies, build commands, database, login, API keys, cookies for advertising, or paid services.

## What is included

- `index.html`: Home
- `community.html`: Community and how to join
- `bots.html`: Discord bot overview and policy links
- `terms.html`: Website and community bot terms
- `privacy.html`: Website and community bot privacy information
- `cookies.html`: Cookie and browser storage policy, plus a working clear-preference action
- `404.html`: Custom page not found screen
- `assets/logo.png`: Original image supplied by the community
- `assets/favicon.png`: Small site icon cropped from the supplied logo, replace any time
- `assets/site.css`: Desktop and mobile design
- `assets/site.js`: Mobile navigation, copyright year, copy-link notifications, storage notice
- `.nojekyll`: Instructs GitHub Pages to serve the files without a Jekyll transformation

## Go live for free on GitHub Pages

These instructions require no terminal or command line.

1. Sign in at https://github.com and click **New repository**.
2. Use your existing public repository **`unnamed79/Grand-Theft-Auto-VI-Online-DIscord-Server.`**. It already contains a README and can be updated with the website files.
3. Open that repository on GitHub.
4. Extract the ZIP file you received. Open the extracted `gta6-online-website` folder.
5. In the new GitHub repository, select **Add file > Upload files**.
6. Upload everything **inside** the extracted folder, including the HTML files, `assets` folder, and `.nojekyll`. GitHub's browser file picker may hide dotfiles, so ensure `.nojekyll` is included. You can also use **Add file > Create new file** to add `.nojekyll` if needed.
7. Commit the files to the `main` branch.
8. Go to **Settings > Pages**. Under **Build and deployment**, select **Deploy from a branch**. Choose branch **`main`**, directory **`/(root)`**, then click **Save**.
9. When the Pages deployment is complete, your website should be at:
   `https://unnamed79.github.io/Grand-Theft-Auto-VI-Online-DIscord-Server./`

GitHub Pages publishing guidance: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

GitHub Pages custom 404 documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site

**Important:** The 404 page's home button is built for the repository name `Grand-Theft-Auto-VI-Online-DIscord-Server.`. If you rename the repository, open `404.html` and change `/Grand-Theft-Auto-VI-Online-DIscord-Server./` to `/YOUR-REPO-NAME/`. If using your own domain, change it to `/`.

## How to preview on your computer

Opening `index.html` directly generally shows the pages, but some browser security features work best through a local server. From inside the site folder, you can run `python -m http.server 8000` and open http://localhost:8000/ in your browser. This preview is optional, not a requirement for GitHub hosting.

## What you may want to change later

- **Add social links:** The user did not supply public social URLs, so none were invented. Add verified social links when they are ready.
- **Favicon:** Swap `assets/favicon.png` for the dedicated icon you prefer.
- **Logo:** Replace `assets/logo.png` with another image of the same name to change the brand mark.
- **Text or layout:** Edit the matching HTML or `assets/site.css` file.
- **Email:** Currently `gta6onlinediscord@gmail.com`.
- **Discord:** Currently `https://discord.gg/NAFJHVsYta`.

## Legal content: important before publishing

These policies are editorial drafts, **not legal advice**. In particular, the bot privacy page must be reviewed against the real bot setup. The website does not have access to bot source code, logs, retention settings, processors, hostnames, or moderation workflows. Before declaring the bot privacy policy accurate, confirm:

1. Which custom bots the community operates and which information each bot collects or accesses.
2. Whether message content, user and server identifiers, applications, attachments, tickets or moderation logs are stored.
3. Where each bot is hosted and which third-party services, analytics services, or SDKs process data.
4. Exactly who can access stored information and how long each category is kept.
5. A workable data access and deletion process and any exceptions.
6. Whether an age verification or parental consent procedure is legally required for any actual data collection. The current site collects no birthday, sign-up, or form data. Discord age eligibility alone is not an across-the-board legal substitute for parental consent.
7. Rules and requirements in the jurisdictions of the users and bot operators.

Do not publish an inaccurate bot policy. Have the appropriate operator or a qualified adviser review it if your bots process personal data.

## Security characteristics and limits

Completed by design:
- No JavaScript frameworks or dependency packages to audit or update.
- No secret keys, API tokens, `.env` files, passwords, authentication, admin area, or database included.
- No public forms or site API endpoints; therefore no form injection, API authorization, login brute force, server rate limiting, or SQL injection surface within this website.
- Only trusted, static text is inserted as markup. Browser-visible notifications use `textContent`, not `innerHTML`.
- External Discord links use `rel="noopener noreferrer"`.
- Each regular HTML page includes a restrictive Content Security Policy via a `meta` tag, plus a referrer policy. Meta CSP is not equivalent to configurable HTTP security headers.
- No third-party JavaScript, fonts, SDKs, or tracking cookies.
- Mobile navigation is keyboard-accessible, with focus indicators and reduced-motion support.

Limits:
- GitHub Pages serves static files. It cannot implement server-side rate limiting, secure login, protected admin routes, private API keys, database access rules, or custom HTTP headers for you. Those concerns apply to your bots and their separate hosting, not this website.
- `404.html` is a standalone page and uses its own embedded CSS to work even for missing nested URLs; it has no scripts and no user data inputs.
- You should still review every repository commit for secrets before publishing. The website can be checked, but there is no access to your other Git repositories, Discord bot code, or bot hosting configuration.
- A **full** security audit of your bots or unrelated infrastructure is not possible from these website files.
- GitHub, Discord, and email providers may process information in accordance with their own policies.

## Test checklist

- Open all seven pages, including `404.html`.
- Test desktop and mobile menu and the header logo.
- Test Join Discord and email links.
- Test Copy invite on the published HTTPS website, including success and error notices.
- Dismiss the storage notice, refresh, then clear the preference on the Cookies page.
- Check how your chosen repository name changes the 404 home URL.
- Verify bot policy statements before the public launch.

## Credit

This is an independent fan-run website, not an official Rockstar Games or Take-Two Interactive website. User-supplied community logo is used for branding.
