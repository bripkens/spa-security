# spa-security

Just a playground for SPA authentication prototypes.

## How to run

 1. Make sure you have Redis running on your machine, e.g. via Docker
    `docker run -d --name redis -p 6379:6379 dockerfile/redis`
 2. Make sure you have Node.js ^0.10.26 with NPM
 3. Install all the dependencies: `npm install`
 4. Run the app `node lib $REDIS_HOST $REDIS_PORT`.

Supercharge your development experience using the `run.bash` script that
automatically restarts the server on changes.

## How to inspect Redis

```
docker run -it --rm --link redis:redis dockerfile/redis bash -c 'redis-cli -h $REDIS_PORT_6379_TCP_ADDR'
```

## TODO

 - prepend JSON responses with `for(;;);`
 - access token timeouts
 - remember me functionality
