    project-root/

      💡 Documentations & diagrams on local development steps, deployment processes, etc
      /docs

      💡 Database logic only (schema, connection, data-in/data-out, no business logic)
      /prisma

      💡 Application log files (combined, error, request/response)
      /logs

      💡 Keep all your code files seperate from configuration files
      /src

          💡 REST API routes, keep them clean & short
          /routes

          💡 Responsible for receiving & returning data to routes
          /controllers

          💡 Core business logic
          /services

          💡 Optional: Static values you might use across the project
          /constants

          💡 Wrappers for 3rd party SDKs/APIs, such as Stripe/Shopify APIs
          /libs

          💡 Parsing errors, protecting endpoints, caching, etc
          /middlewares

          💡 Optional: Type definitions if needed
          /types

          💡 Optional: Functions / classes for validating incoming API payloads
          /validators

          💡 Optional: only if you rely on generated types/functions
          /generated

          💡 Optional: Some teams call it 'utils' folder
          /common

          💡 Configure your logger here
          logger.ts

          💡 Centralise your environment variables in one place
          env.ts

      💡 Keep configuration files in root folder
      package.json
      .prettierrc
      .prettierignore
      .eslintrc.js
      .eslintignore
      yarn.lock
