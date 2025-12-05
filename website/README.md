# Codecov Dashboard

A React-based web dashboard for visualizing test results and code coverage metrics from GitHub repositories using the codecov-action.

## Features

- 📊 **Coverage Trends** - Line and branch coverage over time
- ✅ **Test Results** - Pass rates, failures, and test counts
- 🌿 **Branch Comparison** - View metrics for different branches
- ⏰ **Time Filters** - Filter data by time range (7, 30, 90 days, all time)
- 📈 **Interactive Charts** - Built with Recharts for beautiful visualizations
- 🎨 **Modern UI** - Styled with Tailwind CSS and shadcn/ui components

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Recharts** - Charts and visualizations
- **Octokit** - GitHub API client
- **date-fns** - Date formatting
- **JSZip** - Artifact parsing

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

## Usage

### View Repository Coverage

Navigate to `/:owner/:repo` to view a repository's dashboard:

```
http://localhost:5173/mathuraditya724/codecov-action
```

### Requirements

The repository must:
1. Be public (or you'll need to add GitHub OAuth)
2. Have the codecov-action configured and running
3. Have workflow runs with codecov artifacts

## How It Works

1. **Fetch Branches** - Gets all branches from the repository
2. **Fetch Workflow Runs** - Gets successful workflow runs for selected branch
3. **Download Artifacts** - Downloads `codecov-test-results-*` and `codecov-coverage-results-*` artifacts
4. **Parse Data** - Extracts test and coverage metrics from artifacts
5. **Visualize** - Displays trends, charts, and tables

## Project Structure

```
website/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── BranchSelector.tsx
│   │   ├── TimeRangeFilter.tsx
│   │   ├── CoverageChart.tsx
│   │   ├── TestResultsChart.tsx
│   │   ├── RunsTable.tsx
│   │   └── StatCard.tsx
│   ├── pages/              # Page components
│   │   ├── HomePage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/           # API services
│   │   ├── githubAPI.ts
│   │   └── artifactParser.ts
│   ├── hooks/              # Custom React hooks
│   │   ├── useBranches.ts
│   │   └── useArtifacts.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── package.json
└── vite.config.ts
```

## API Rate Limits

The dashboard uses GitHub's public API without authentication:
- **Rate Limit**: 60 requests per hour per IP
- **Solution**: The dashboard limits artifact fetching to the 20 most recent runs

To increase limits, implement GitHub OAuth (5000 requests/hour).

## Deployment

### GitHub Pages

1. Add deployment workflow (`.github/workflows/deploy-dashboard.yml`):

```yaml
name: Deploy Dashboard
on:
  push:
    branches: [main]
    paths: ['website/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
      - run: cd website && pnpm install && pnpm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website/dist
```

2. Enable GitHub Pages in repository settings
3. Access at `https://[username].github.io/codecov-action/`

### Other Platforms

- **Vercel**: Connect repository and set root directory to `website/`
- **Netlify**: Deploy from `website/` with build command `pnpm run build`
- **Cloudflare Pages**: Point to `website/dist` directory

## Future Enhancements

- [ ] GitHub OAuth for private repos and higher rate limits
- [ ] Commit comparison view
- [ ] File-level coverage drill-down
- [ ] Export to CSV/PDF
- [ ] Real-time updates via webhooks
- [ ] Coverage badges generation
- [ ] Dark/Light theme toggle (theme switching is ready, just needs UI)

## License

MIT

