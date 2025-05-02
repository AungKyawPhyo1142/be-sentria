## Contribution

### Code of conduct

We expect all contributors to follow these guidelines to ensure a consistent and high-quality codebase:

- **Variable Naming**:

  - Use "camel case" for variable names. For example, `let helloWorld = 1`.
  - Use "upper case snake case" for constant variables. For example, `const HELLO_WORLD = "A"`.

- **Before pushing to remote**:

  - Make sure your local server is pointing to backend's DEV-SERVER
  - Never push directly to the production branch (main)

### Branching Strategy

We follow the [Gitflow workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for our branching strategy. This involves the following branches:

- **Main Branch (`main`)**: The stable version of the project. All releases are tagged here.
- **Development Branch (`dev`)**: The active development branch where integration of features and fixes happens before release.
- **Feature Branches**: Branch off from `dev` for new features or bug fixes. Use the convention `feature/short-description` or `bugfix/short-description`.
- **Release Branches**: Branch off from `dev` to prepare for a release. Use the convention `release/x.x.x`.
- **Hotfix Branches**: Branch off from `main` for urgent fixes. Use the convention `hotfix/short-description`.

### Commit Message Guidelines

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard for commit messages. This includes:

- **Structure**: `type(scope): subject`
- **Types**:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation changes
  - `style`: Changes that do not affect the meaning of the code (e.g., white-space, formatting)
  - `refactor`: Code changes that neither fixes a bug nor adds a feature
  - `test`: Adding or updating tests
  - `chore`: Changes to the build process or auxiliary tools and libraries

Example commit message:

```
feat(auth): add JWT authentication

Implement JWT authentication for securing API endpoints.
```

### Coding Standards

- Use **TypeScript** with strict type settings to ensure type safety across the project.

- Always run formatting and clean up script before committing your changes:
  `npm run clean`
