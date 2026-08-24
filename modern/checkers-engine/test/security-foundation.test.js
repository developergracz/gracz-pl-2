import test from "node:test";
import assert from "node:assert/strict";
import { TokenService } from "../src/token-service.js";
import { SecurityService } from "../src/security-service.js";
import { LoginRateLimiter, RateLimitError } from "../src/rate-limit.js";

function request({method="POST",host="gracz.pl",origin="https://gracz.pl",fetchSite="same-origin"}={}){return{method,url:"/test",headers:{host,origin,"sec-fetch-site":fetchSite},socket:{remoteAddress:"127.0.0.1"}};}

test("TokenService stores only hash-compatible values",()=>{const service=new TokenService();const issued=service.issue();assert.ok(issued.token.length>30);assert.equal(issued.tokenHash.length,32);assert.equal(service.equals(issued.token,issued.tokenHash),true);assert.equal(service.equals(`${issued.token}x`,issued.tokenHash),false);});

test("SecurityService blocks cross-site mutations",()=>{const service=new SecurityService();assert.throws(()=>service.assertSameOrigin(request({origin:"https://evil.example",fetchSite:"cross-site"})),error=>error.code==="CROSS_SITE_REQUEST");assert.doesNotThrow(()=>service.assertSameOrigin(request()));});

test("LoginRateLimiter uses progressive lockout",()=>{let now=0;const limiter=new LoginRateLimiter({maxAttempts:2,lockoutMs:1000,maxLockoutMs:8000,sourceMaxAttempts:100,clock:()=>now});const key="127.0.0.1:user";limiter.recordFailure(key);limiter.recordFailure(key);assert.throws(()=>limiter.assertAllowed(key),RateLimitError);now=1001;assert.doesNotThrow(()=>limiter.assertAllowed(key));limiter.recordFailure(key);limiter.recordFailure(key);assert.throws(()=>limiter.assertAllowed(key),error=>error instanceof RateLimitError&&error.retryAfterSeconds>=2);});
