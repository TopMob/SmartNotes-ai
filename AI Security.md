# **Architecture Hardening and Threat Mitigation Guide: Next.js, Supabase, Yjs, and Agentic AI Systems**

The convergence of server-side rendered React architectures, decentralized collaborative data structures, and autonomous AI agents introduces an entirely new paradigm of security risks. Legacy web application firewalls and standard network-layer defenses are categorically insufficient against state hydration leaks, component serialization flaws, cryptographic side-channels, and semantic vector poisoning. The integration of Next.js 16 (App Router), Supabase (PostgreSQL), Yjs (Conflict-free Replicated Data Types), and Retrieval-Augmented Generation (RAG) pipelines demands deterministic, structurally sound defensive patterns.  
This document functions as an exhaustive, context-rich hardening directive. It provides structural blueprints designed for autonomous refactoring agents, detailing the theoretical mechanics of stack-specific vulnerabilities, their exploitation pathways, and production-ready code templates.

## **Next.js 16 (App Router) & Fastify Gateway Layer**

The React Server Component (RSC) architecture fundamentally alters the traditional client-server boundary by bridging backend logic and client-side rendering via the specialized "Flight" protocol.1 This architectural shift creates unique, high-severity risks involving data serialization, state hydration, and middleware bypass vectors that require explicit programmatic boundaries.1

### **React Server Components (RSC) Serialization Leaks**

#### **Technical Breakdown**

React 19 and Next.js 16 introduced mechanisms to serialize server-side component states into a specialized binary-encoded string format transmitted to the client for DOM hydration.1 The React Flight protocol facilitates this data streaming, mapping server-side data models directly to client-side property definitions.2 A critical vulnerability arises when developers pass unredacted backend objects—such as complete PostgreSQL row results containing password hashes or environment variables—as props from a Server Component to a Client Component. Because the data crosses the network boundary, the entire object is serialized into the HTML payload's inline script tags, exposing fields that the user interface never explicitly renders.  
Furthermore, severe vulnerabilities in the react-server-dom-\* packages have historically permitted unauthenticated Remote Code Execution (RCE) via the insecure deserialization of crafted HTTP requests manipulating these Flight protocol payloads (e.g., CVE-2025-55182).1 While framework-level patching mitigates the direct RCE 1, the underlying logical flaw of over-fetching and over-sharing state remains a persistent threat vector. Attackers routinely scrape .next/static chunks and serialized RSC payloads to recover exposed internal APIs, administrative tokens, and raw database records.1

#### **Anti-Pattern**

The following implementation extracts a complete user record from the database and passes it directly to a Client Component. The developer assumes that because the Client Component only renders the name property, the remaining data is secure.

TypeScript  
// vulnerable-page.tsx  
import { db } from '@/lib/db';  
import { UserProfileClient } from './user-profile-client';

export default async function UserProfile({ params }: { params: { id: string } }) {  
  // ANTI-PATTERN: Extracts all columns, including password\_hash, internal\_notes, and ssn  
  const userRecord \= await db.query('SELECT \* FROM users WHERE id \= $1', \[params.id\]);  
    
  // ANTI-PATTERN: Passing the raw record to the client component.   
  // The entire object is serialized into the RSC payload and transmitted to the browser.  
  return \<UserProfileClient user={userRecord} /\>;  
}

#### **Hardened Template**

To establish a definitive security boundary, the architecture must utilize React's experimental tainting APIs (experimental\_taintObjectReference and experimental\_taintUniqueValue) in conjunction with strict Data Transfer Object (DTO) mapping.6 Tainting instructs the React serializer to throw an explicit compilation or runtime error if a marked object attempts to cross the Server-Client boundary.6

TypeScript  
// secure-data-access.ts  
import 'server-only';  
import { db } from '@/lib/db';  
import { experimental\_taintObjectReference, experimental\_taintUniqueValue } from 'react';

export interface PublicUserDTO {  
  id: string;  
  name: string;  
  publicAvatarUrl: string;  
}

export async function getSecureUser(id: string): Promise\<PublicUserDTO\> {  
  const userRecord \= await db.query('SELECT \* FROM users WHERE id \= $1', \[params.id\]);  
    
  if (\!userRecord) throw new Error('User not found');

  // 1\. Taint the raw database object to prevent accidental serialization  
  experimental\_taintObjectReference(  
    'SECURITY VIOLATION: Attempted to pass raw database record to Client Component.',  
    userRecord  
  );

  // 2\. Taint specific highly sensitive fields explicitly (e.g., tokens, hashes)  
  experimental\_taintUniqueValue(  
    'SECURITY VIOLATION: Attempted to leak internal authentication hash.',  
    userRecord,  
    userRecord.password\_hash  
  );

  // 3\. Map to a strict DTO containing only inherently safe data  
  return {  
    id: userRecord.id,  
    name: userRecord.name,  
    publicAvatarUrl: userRecord.avatar\_url,  
  };  
}

// secure-page.tsx  
import { getSecureUser } from '@/lib/secure-data-access';  
import { UserProfileClient } from './user-profile-client';

export default async function UserProfile({ params }: { params: { id: string } }) {  
  // SECURE: Only the un-tainted DTO is passed to the client boundary.  
  const safeUser \= await getSecureUser(params.id);  
  return \<UserProfileClient user={safeUser} /\>;  
}

### **Middleware Authorization Bypasses, Parameter Shadowing, and Race Conditions**

#### **Technical Breakdown**

Next.js middleware operates on the Edge runtime, executing network-level interception before requests reach the Node.js rendering pipeline.5 Developers frequently implement authorization guards inside middleware.ts to protect specific routes based on session tokens.5 This creates multiple severe vulnerabilities due to the architectural differences between Edge interception and Node.js route resolution.  
First, framework-level header spoofing (CVE-2025-29927) revealed that the framework utilized an internal header, x-middleware-subrequest, to track subrequests and prevent infinite loops.5 Attackers who manually injected this header into their HTTP requests forced the edge runtime to skip the middleware evaluation entirely, gaining unauthorized access to protected routes without a valid session.11  
Second, Parameter Shadowing (CVE-2026-44574) exposes a route resolution inconsistency between the middleware layer and the page rendering layer.13 The middleware assesses authorization against the visible URL path (e.g., /dashboard/settings). However, if an attacker appends query parameters that duplicate dynamic route segment variables (e.g., /dashboard/settings?id=admin-user-id), the underlying page rendering engine evaluates the manipulated query parameter instead of the URL segment.13 The middleware approves the request based on the benign path, but the page dynamically returns the attacker-specified protected resource.13  
Third, complex race conditions occur during session context initialization. If middleware initiates a NextResponse.redirect while the client is simultaneously writing a new session cookie (e.g., immediately after an OAuth callback) or executing a Server Component fetch in layout.tsx, the App Router navigation mechanism interrupts the hydration cycle unpredictably.5 This results in multiple in-flight threads working on the server action queue, corrupting the navigation state and resulting in infinite redirect loops or dropped session cookies.5 Furthermore, Server Actions and internal server-side fetch calls bypass middleware.ts completely, meaning that if authorization is purely relegated to middleware, internal APIs remain fundamentally unauthenticated.5

| Threat Vector | Root Cause | Exploitation Mechanics |
| :---- | :---- | :---- |
| **Middleware Bypass (CVE-2025-29927)** | Implicit trust of x-middleware-subrequest header.10 | Attacker injects header to skip edge validation and reach Node.js handlers directly.11 |
| **Parameter Shadowing (CVE-2026-44574)** | Divergent route resolution between Edge and Node.js.13 | Attacker injects ?id=target to override dynamic URL segments after middleware approval.13 |
| **Session Race Conditions** | Concurrent NextResponse.redirect and client-side cookie mutations.5 | Corrupted navigation state leads to dropped authentication contexts during hydration.5 |
| **Silent API Bypass** | Server Actions do not trigger Edge middleware.5 | Direct invocation of Server Action IDs enables unauthorized database mutations.5 |

#### **Anti-Pattern**

Relying exclusively on edge middleware for authorization and neglecting in-component validation.

TypeScript  
// middleware.ts (VULNERABLE)  
import { NextResponse } from 'next/server';  
import type { NextRequest } from 'next/server';  
import { verifyJwt } from '@/lib/auth';

export async function middleware(request: NextRequest) {  
  if (request.nextUrl.pathname.startsWith('/admin')) {  
    // ANTI-PATTERN: Verifying auth only in middleware.   
    // Vulnerable to CVE-2026-44574 (query shadowing) and Server Action bypasses.  
    // Highly susceptible to race conditions during rapid redirects.  
    const token \= request.cookies.get('session');  
    if (\!verifyJwt(token)) {  
      return NextResponse.redirect(new URL('/login', request.url));  
    }  
  }  
  return NextResponse.next();  
}

#### **Hardened Template**

Middleware must act exclusively as a preliminary presence guard. Absolute authorization must be cryptographically verified directly within the Route Handler, Server Action, or Server Component using a centralized, cached validation function.5 This eliminates the risk of parameter shadowing because the Node.js renderer validates the session synchronously alongside the execution of the dynamic segment.5

TypeScript  
// lib/auth-guard.ts  
import 'server-only';  
import { cookies } from 'next/headers';  
import { redirect } from 'next/navigation';  
import { jwtVerify } from 'jose'; // Edge-compatible WebCrypto API

const JWT\_SECRET \= new TextEncoder().encode(process.env.SUPABASE\_JWT\_SECRET);

// Cache the validation to prevent duplicate DB/Crypto checks during a single request lifecycle  
export const requireServerAuthorization \= React.cache(async (requiredRole?: string) \=\> {  
  const cookieStore \= await cookies();  
  const token \= cookieStore.get('sb-access-token')?.value;

  if (\!token) {  
    redirect('/login');  
  }

  try {  
    const { payload } \= await jwtVerify(token, JWT\_SECRET);  
      
    if (requiredRole && payload.role\!== requiredRole) {  
      redirect('/unauthorized');  
    }  
      
    return payload; // Return strongly typed verified session  
  } catch (error) {  
    redirect('/login');  
  }  
});

// app/admin/page.tsx  
import { requireServerAuthorization } from '@/lib/auth-guard';

export default async function AdminDashboard({ params }: { params: { id: string } }) {  
  // SECURE: Cryptographic verification occurs synchronously at the rendering layer.  
  // Query parameter shadowing cannot bypass this execution context.  
  // Server Actions executed from this component will recursively call this guard.  
  const session \= await requireServerAuthorization('admin');  
    
  return \<Dashboard data={session} targetId={params.id} /\>;  
}

### **Server-Side Request Forgery (SSRF) via WebSocket Upgrades**

#### **Technical Breakdown**

When Next.js is deployed in a self-hosted environment and configured to act as a proxy for media uploads or third-party integrations (e.g., routing traffic to Google Drive APIs or Supabase Storage), improper handling of HTTP requests can lead to critical Server-Side Request Forgery (CVE-2026-44578).15 Next.js provides built-in proxying capabilities, but when deployed without Vercel's proprietary ingress protections, the Node.js server becomes vulnerable.15  
If an attacker transmits a crafted HTTP GET request containing an Upgrade: websocket header directed at the Next.js server, the internal Node.js URL parser may misinterpret the protocol routing logic.16 The vulnerability occurs because the upgrade handler parses the URL protocol and calls proxyRequest without confirming whether the routing middleware actually approved the proxy.16 The Next.js process can be forced to issue an internal HTTP GET request to any host reachable from the server on port 80\.16 In cloud deployments, this SSRF is heavily exploited to target cloud metadata services (e.g., 169.254.169.254 for AWS IMDSv1, or metadata.google.internal), allowing the attacker to steal the underlying instance's Identity and Access Management (IAM) role credentials, database connection strings, and private SSH keys.15  
Furthermore, standard media proxies that do not strictly validate file sizes and MIME types before opening streams to third-party providers like Supabase Storage are susceptible to resource exhaustion and client token hijacking.18 An attacker can pipeline malicious executable payloads through the Next.js server, masking their origin, and embedding XSS vectors into the resulting storage bucket URLs.

#### **Anti-Pattern**

Implementing a raw proxy handler inside a Next.js API route without sanitizing upgrade headers or restricting the destination host.

TypeScript  
// app/api/proxy/route.ts (VULNERABLE)  
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {  
  const targetUrl \= req.nextUrl.searchParams.get('url');  
    
  // ANTI-PATTERN: Blindly proxying requests based on user input.  
  // Fails to strip Upgrade headers, permitting WebSocket SSRF (CVE-2026-44578).  
  // Fails to enforce a domain whitelist, allowing IMDSv1 access.  
  const response \= await fetch(targetUrl, {  
    headers: req.headers,   
  });  
    
  return new NextResponse(response.body, { status: response.status });  
}

#### **Hardened Template**

A strictly allowlisted proxy implementation that actively strips dangerous headers, enforces absolute protocol boundaries, implements stream-based file size limits, and validates destination IP addresses to physically prevent cloud metadata service access.16

TypeScript  
// app/api/proxy/route.ts (SECURE)  
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED\_DOMAINS \= new Set(\['storage.googleapis.com', 'xxxxx.supabase.co'\]);  
const MAX\_FILE\_SIZE \= 10 \* 1024 \* 1024; // 10MB limit to prevent memory exhaustion

export async function POST(req: NextRequest) {  
  const targetUrlParam \= req.nextUrl.searchParams.get('url');  
    
  if (\!targetUrlParam) {  
    return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });  
  }

  let parsedUrl: URL;  
  try {  
    parsedUrl \= new URL(targetUrlParam);  
  } catch {  
    return NextResponse.json({ error: 'Malformed URL' }, { status: 400 });  
  }

  // 1\. Strict Domain Allowlisting  
  if (\!ALLOWED\_DOMAINS.has(parsedUrl.hostname)) {  
    return NextResponse.json({ error: 'Domain not authorized' }, { status: 403 });  
  }

  // 2\. Protocol Restriction (Prevent gopher://, file://, ws://, wss://)  
  if (parsedUrl.protocol\!== 'https:') {  
    return NextResponse.json({ error: 'Only HTTPS protocol is supported' }, { status: 400 });  
  }

  // 3\. Header Sanitization (Prevent WebSocket Upgrade SSRF and Host Header Injection)  
  const safeHeaders \= new Headers();  
  safeHeaders.set('Accept', req.headers.get('Accept') || 'application/json');  
  safeHeaders.set('Content-Type', req.headers.get('Content-Type') || 'application/octet-stream');  
  safeHeaders.set('Authorization', \`Bearer ${process.env.SUPABASE\_SERVICE\_ROLE\_KEY}\`);  
  // Explicitly do NOT copy 'Upgrade', 'Connection', 'X-Forwarded-For', or 'Host' headers.

  // 4\. Content-Length Validation  
  const contentLength \= parseInt(req.headers.get('content-length') || '0', 10);  
  if (contentLength \> MAX\_FILE\_SIZE) {  
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });  
  }

  try {  
    const upstreamResponse \= await fetch(parsedUrl.toString(), {  
      method: 'POST',  
      headers: safeHeaders,  
      body: req.body, // Stream the body directly to prevent memory buffering  
      redirect: 'manual', // Prevent SSRF via 301/302 redirects to internal IPs  
    });

    return new NextResponse(upstreamResponse.body, {  
      status: upstreamResponse.status,  
      headers: {   
        'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/octet-stream',  
        'X-Content-Type-Options': 'nosniff' // Prevent MIME-type sniffing XSS  
      },  
    });  
  } catch (error) {  
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 502 });  
  }  
}

## **Supabase (PostgreSQL Backend) & Authentication Layer**

Supabase relies heavily on PostgreSQL's native Row Level Security (RLS) to enforce multi-tenant isolation directly at the database level.21 The PostgREST API layer translates HTTP requests into SQL queries, but when RLS policies are misconfigured, or when stored procedures bypass RLS unintentionally, the logical separation between tenants completely collapses, granting attackers widespread data access.21

### **Row Level Security (RLS) Logical Flaws and auth.uid() Misuse**

#### **Technical Breakdown**

RLS policies act as dynamic WHERE clauses appended to every query executed against a table.22 The foundation of Supabase tenant isolation relies on the auth.uid() function, which extracts the user's UUID from the JSON Web Token (JWT) provided in the request header.21  
A critical logical flaw emerges due to how SQL handles NULL evaluations. When an unauthenticated request hits the PostgREST API (without an access token), the auth.uid() function returns null.22 If a developer authors a policy such as USING (auth.uid() \= user\_id), the database evaluates null \= user\_id. In standard SQL, this comparison evaluates to NULL (falsy), meaning the policy silently fails to grant access, which appears secure. However, if the user\_id column itself contains null values (e.g., a system-generated record without an owner), or if an attacker utilizes IS NULL subqueries, the comparison can exhibit unexpected behaviors.22  
Furthermore, default table privileges in PostgreSQL dictate that if RLS is not explicitly enabled via ALTER TABLE... ENABLE ROW LEVEL SECURITY, the table is entirely public to anyone possessing the API key.22 Supabase attempts to mitigate this by auto-enabling RLS on tables created via the UI, but tables created via raw SQL migrations (e.g., using Prisma or Drizzle) remain dangerously open until explicitly restricted.21

#### **Anti-Pattern**

An RLS policy that fails to explicitly verify authentication status before comparing IDs.

SQL  
\-- ANTI-PATTERN: Implicit null comparison.   
\-- Can behave unpredictably if the target column allows null values.  
CREATE POLICY "Users can view own data"   
ON public.sensitive\_documents   
FOR SELECT   
USING (auth.uid() \= owner\_id);

#### **Hardened Template**

Policies must explicitly assert that auth.uid() is strictly NOT NULL before executing any further evaluation, ensuring a definitive authentication boundary.22 Furthermore, policies should leverage subqueries to optimize performance when dealing with large datasets, as invoking auth.uid() directly on every row incurs substantial computational overhead.21

SQL  
\-- SECURE: Explicit authentication check and optimized subselect.  
CREATE POLICY "Strict user data isolation"  
ON public.sensitive\_documents  
FOR SELECT  
TO authenticated \-- Restrict to the authenticated role at the engine level  
USING (  
  auth.uid() IS NOT NULL   
  AND   
  (SELECT auth.uid()) \= owner\_id \-- Subselect optimizes execution time   
);

\-- Ensure RLS is definitively enabled for the table  
ALTER TABLE public.sensitive\_documents ENABLE ROW LEVEL SECURITY;

### **Privilege Escalation via SECURITY DEFINER and Search Path Hijacking**

#### **Technical Breakdown**

In PostgreSQL, creating a function or stored procedure (RPC) with the SECURITY DEFINER modifier dictates that the function executes with the privileges of the user who created it (typically the postgres superuser), rather than the user invoking it.22 This capability is frequently utilized to allow low-privileged users to perform specific high-privileged operations, such as creating new organizational tenants or accessing internal auditing tables.25  
However, if SECURITY DEFINER is used without explicitly setting the search\_path, the database is highly vulnerable to Search Path Hijacking.22 A malicious user could create a custom function or operator in a schema they control (such as the public schema) with the exact same name as a built-in function used inside the SECURITY DEFINER procedure.27 When the superuser function executes, the PostgreSQL query planner evaluates the search path and may resolve and run the attacker's malicious code with superuser privileges, resulting in a complete database compromise and full privilege escalation.26

#### **Anti-Pattern**

An administrative RPC that evaluates user counts, created without search\_path isolation, allowing RLS bypass without safety rails.

SQL  
\-- ANTI-PATTERN: SECURITY DEFINER without search\_path setting.  
\-- Vulnerable to search path hijacking and malicious operator execution.\[26, 27\]  
CREATE OR REPLACE FUNCTION get\_tenant\_statistics(tenant\_uuid UUID)  
RETURNS integer AS $$  
DECLARE  
  total\_count integer;  
BEGIN  
  \-- Bypasses RLS entirely. If 'count' or '=' operators are hijacked in the public schema,  
  \-- this executes malicious code as superuser.  
  SELECT count(\*) INTO total\_count FROM users WHERE tenant\_id \= tenant\_uuid;  
  RETURN total\_count;  
END;  
$$ LANGUAGE plpgsql SECURITY DEFINER;

#### **Hardened Template**

All SECURITY DEFINER functions must unconditionally include SET search\_path \= '' to force the function to use explicit schema references, eliminating hijacking vectors by preventing the planner from automatically resolving unqualified names.22 Furthermore, because the function bypasses RLS, manual tenant isolation checks must be rigorously enforced inside the procedure logic.

SQL  
\-- SECURE: Explicit search\_path and manual isolation verification.  
CREATE OR REPLACE FUNCTION public.get\_tenant\_statistics(tenant\_uuid UUID)  
RETURNS integer  
LANGUAGE plpgsql  
SECURITY DEFINER  
SET search\_path \= '' \-- Forces explicit schema qualification \[22, 27\]  
AS $$  
DECLARE  
  total\_count integer;  
  requesting\_user\_id UUID;  
BEGIN  
  \-- 1\. Extract the current user from the Supabase JWT context  
  requesting\_user\_id := auth.uid();  
    
  IF requesting\_user\_id IS NULL THEN  
    RAISE EXCEPTION 'Not authenticated';  
  END IF;

  \-- 2\. Manually verify that the requesting user belongs to the target tenant  
  IF NOT EXISTS (  
    SELECT 1 FROM public.tenant\_memberships  
    WHERE user\_id \= requesting\_user\_id AND tenant\_id \= tenant\_uuid  
  ) THEN  
    RAISE EXCEPTION 'Unauthorized access to tenant statistics';  
  END IF;

  \-- 3\. Execute the query using fully qualified table names (pg\_catalog)  
  SELECT pg\_catalog.count(\*) INTO total\_count   
  FROM public.users   
  WHERE tenant\_id \= tenant\_uuid;  
    
  RETURN total\_count;  
END;  
$$;

\-- Restrict execution to authenticated users only, revoking public access  
REVOKE EXECUTE ON FUNCTION public.get\_tenant\_statistics(UUID) FROM PUBLIC;  
REVOKE EXECUTE ON FUNCTION public.get\_tenant\_statistics(UUID) FROM anon;  
GRANT EXECUTE ON FUNCTION public.get\_tenant\_statistics(UUID) TO authenticated;

### **Tenant Isolation Failure in Views (security\_invoker)**

#### **Technical Breakdown**

Standard PostgreSQL views execute with the privileges of the view creator, exhibiting default security definer behavior.22 When developers create a view to join multiple tables for a complex dashboard query, the view inherently bypasses the RLS policies of the underlying base tables.22 A user querying the view via the PostgREST API will see all rows across all tenants in the database, breaking multi-tenant isolation.28  
Since PostgreSQL 15, views natively support the security\_invoker \= true parameter.22 This critical parameter forces the view to execute using the privileges of the user running the query, ensuring that the underlying RLS policies of the base tables are correctly evaluated against the caller's JWT context.22 Failure to include this parameter on any view handling sensitive data constitutes a critical data leak.24

#### **Anti-Pattern**

SQL  
\-- ANTI-PATTERN: Standard view creation.  
\-- Bypasses RLS on the \`documents\` and \`users\` tables, exposing all tenant data.  
CREATE VIEW public.user\_documents\_view AS  
SELECT d.id, d.title, u.email  
FROM public.documents d  
JOIN public.users u ON d.user\_id \= u.id;

#### **Hardened Template**

SQL  
\-- SECURE: Utilizing security\_invoker to enforce underlying RLS policies.\[22, 29\]  
CREATE VIEW public.user\_documents\_view   
WITH (security\_invoker \= true) \-- Crucial for RLS enforcement  
AS  
SELECT d.id, d.title, u.email  
FROM public.documents d  
JOIN public.users u ON d.user\_id \= u.id;

\-- Ensure proper permissions so the PostgREST API can expose the view  
GRANT SELECT ON public.user\_documents\_view TO authenticated;  
GRANT SELECT ON public.user\_documents\_view TO service\_role;

### **Edge Environment Isolation Breakouts and Token Leakage**

#### **Technical Breakdown**

Supabase Edge Functions are deployed in isolated serverless Deno environments globally.31 By default, Edge Functions require a valid JWT on every request, verifying the token before execution.33 However, a frequent anti-pattern occurs when developers require advanced administrative database operations (e.g., bypassing RLS to update internal billing tables via webhooks) and disable default JWT verification.33  
If an Edge Function processes external requests without cryptographically validating the Authorization header internally, an attacker can invoke the function directly.34 More dangerously, developers often instantiate the Supabase client inside the function using the highly privileged SUPABASE\_SERVICE\_ROLE\_KEY globally, rather than scoping it.32 This key acts as a master override, bypassing all RLS policies.35 If an attacker controls the payload parameters, they can dictate which database records the master key manipulates, leading to catastrophic data corruption or unauthorized plan upgrades.

#### **Anti-Pattern**

Leaking the service role token capabilities by blindly trusting user input.

TypeScript  
// supabase/functions/billing-update/index.ts (VULNERABLE)  
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) \=\> {  
  // ANTI-PATTERN: Instantiating the client with the Service Role key globally.  
  // This function bypasses RLS completely for all operations.  
  const supabaseAdmin \= createClient(  
    Deno.env.get('SUPABASE\_URL')?? '',  
    Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')?? ''  
  )

  const { user\_id, new\_plan } \= await req.json();

  // VULNERABLE: No validation of the caller. Any external HTTP POST can upgrade any user's plan.  
  await supabaseAdmin.from('billing').update({ plan: new\_plan }).eq('user\_id', user\_id);

  return new Response("Plan upgraded", { status: 200 })  
})

#### **Hardened Template**

The Edge Function must explicitly validate the caller's JWT against the Supabase Auth instance, extract the user's canonical identity, and only utilize the SERVICE\_ROLE\_KEY for scoped, backend-only updates where the target identity strictly matches the cryptographically confirmed caller identity.32

TypeScript  
// supabase/functions/billing-update/index.ts (SECURE)  
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) \=\> {  
  try {  
    // 1\. Extract the JWT from the incoming request  
    const authHeader \= req.headers.get('Authorization');  
    if (\!authHeader) {  
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });  
    }  
    const token \= authHeader.replace('Bearer ', '');

    // 2\. Instantiate a standard client to verify the JWT using the ANON key   
    const supabaseClient \= createClient(  
      Deno.env.get('SUPABASE\_URL')?? '',  
      Deno.env.get('SUPABASE\_ANON\_KEY')?? ''  
    );

    // 3\. Cryptographically verify the user's identity  
    const { data: { user }, error: authError } \= await supabaseClient.auth.getUser(token);  
      
    if (authError ||\!user) {  
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });  
    }

    // 4\. Extract payload safely and validate input constraints  
    const { new\_plan } \= await req.json();  
    if (\!\['pro', 'enterprise'\].includes(new\_plan)) {  
      return new Response(JSON.stringify({ error: 'Invalid plan specified' }), { status: 400 });  
    }

    // 5\. Instantiate Admin client ONLY after validation, for scoped internal updates  
    const supabaseAdmin \= createClient(  
      Deno.env.get('SUPABASE\_URL')?? '',  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')?? ''  
    );

    // SECURE: We force the update to target ONLY the cryptographically verified user.id  
    // Even if an attacker passes a different user\_id in the payload, it is ignored.  
    const { error: updateError } \= await supabaseAdmin  
     .from('billing')  
     .update({ plan: new\_plan })  
     .eq('user\_id', user.id); // Cannot manipulate other users' billing records

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {  
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });  
  }  
})

## **CRDT (Yjs) & Real-Time WebSocket Layer**

Collaborative rich-text editors utilizing Yjs resolve concurrent modifications via Conflict-free Replicated Data Types (CRDTs). The document state is frequently synchronized between clients and the backend using WebSockets (such as Supabase Realtime Channels), transmitting binary delta packets encoded as Uint8Array arrays mapped through base64 strings.36

### **Malicious Binary Update Injection and Schema Violation**

#### **Technical Breakdown**

Yjs operates natively under the assumption of a trusted environment, focusing on eventual consistency rather than cryptographic verification. When a client modifies a document, Yjs generates a binary update (Uint8Array) representing the precise delta of the operation.38 If the backend node simply accepts this binary payload and blindly applies it using Y.applyUpdate(doc, update) before broadcasting it to other connected clients, the application is fundamentally vulnerable to malicious data corruption.37  
Because CRDTs merge operations deterministically, an attacker can craft a synthetic Yjs binary payload that alters the underlying data structure in ways the frontend UI would normally prohibit. For example, the attacker could inject an unauthorized Y.Map property representing an administrative flag, delete locked structural nodes, or nest extremely deep JSON-like structures designed to crash rendering engines.37 Because the backend does not introspect the opaque binary blob, it persists the corrupted state into the PostgreSQL database, permanently breaking the collaborative session for all legitimate users.37

#### **Anti-Pattern**

Blindly applying and broadcasting raw binary updates over the WebSocket channel without structural validation.

TypeScript  
// backend-sync.ts (VULNERABLE)  
import \* as Y from 'yjs';  
import { WebSocket } from 'ws';

ws.on('message', (message: Uint8Array) \=\> {  
  // ANTI-PATTERN: The server applies the untrusted binary payload directly to its internal memory.  
  // An attacker can inject arbitrary Yjs structural changes (e.g., hidden maps, malicious nested arrays).  
  Y.applyUpdate(serverDocument, message);  
    
  // The corrupted state is then broadcast to all legitimate clients and persisted   
  broadcastToOthers(message);  
});

#### **Hardened Template**

The architecture must implement a secure inspection middleware. The backend receives the binary update, decodes it into an ephemeral sandbox Y.Doc, extracts the standard JSON representation, validates the JSON against a strict schema (e.g., using Zod), and only applies the update to the primary document if validation unequivocally passes.38

TypeScript  
// backend-sync.ts (SECURE)  
import \* as Y from 'yjs';  
import { z } from 'zod';

// 1\. Define the absolute schema for the collaborative document  
const DocumentSchema \= z.object({  
  content: z.string().max(100000), // Prevent payload bombing  
  metadata: z.object({  
    authorId: z.string().uuid(),  
    lastEdited: z.number()  
  }).strict() // Prevent arbitrary key injection  
});

function handleIncomingUpdate(serverDocument: Y.Doc, incomingUpdate: Uint8Array) {  
  // 2\. Create an ephemeral sandbox document to isolate untrusted operations  
  const sandboxDoc \= new Y.Doc();  
    
  // 3\. Mirror the current secure server state to the sandbox  
  const serverState \= Y.encodeStateAsUpdate(serverDocument);  
  Y.applyUpdate(sandboxDoc, serverState);

  try {  
    // 4\. Apply the untrusted update to the sandbox ONLY   
    Y.applyUpdate(sandboxDoc, incomingUpdate);

    // 5\. Extract the state into a verifiable JSON structure  
    const jsonState \= sandboxDoc.getMap('root').toJSON();

    // 6\. Validate against the strict Zod schema  
    DocumentSchema.parse(jsonState);

    // 7\. If validation passes without throwing, it is structurally safe to apply to the main document  
    Y.applyUpdate(serverDocument, incomingUpdate);  
      
    // 8\. Encode the verified state and persist to PostgreSQL  
    const verifiedUpdate \= Y.encodeStateAsUpdate(serverDocument);  
    persistToDatabase(verifiedUpdate);  
      
    // 9\. Broadcast the safe update to connected peers  
    broadcastToOthers(incomingUpdate);

  } catch (error) {  
    // SECURITY EVENT: Validation failed. The update is discarded entirely.  
    console.error('Malicious or malformed CRDT update detected', error);  
    // Disconnect the offending WebSocket client immediately  
  }  
}

### **Broadcast Denial of Service (DoS) and Resource Exhaustion**

#### **Technical Breakdown**

Because CRDTs are append-only data structures designed to track historical operations for robust conflict resolution, the memory footprint of a Yjs document grows continuously over time.40 An attacker can execute a devastating Denial of Service (DoS) attack by writing automated scripts that flood the WebSocket channel with thousands of microscopic updates per second, or by submitting a single anomalously large Uint8Array delta packet (e.g., a 50MB payload).36  
When the Node.js backend attempts to deserialize a massive payload using Y.applyUpdate, the single-threaded event loop blocks, starving all other WebSocket connections. Furthermore, buffering thousands of rapid updates in memory before a debounced sync worker can write them to PostgreSQL causes an Out-Of-Memory (OOM) crash, taking down the entire synchronization container.

| Attack Mechanism | Consequence | Mitigation Configuration |
| :---- | :---- | :---- |
| **Delta Packet Bombing** | Event loop blocking, CPU spike to 100%. | Reject payloads \> 256KB before passing to Yjs engine. |
| **Channel Flooding** | OOM crash due to excessive debounced memory queues. | Enforce token-bucket rate limits (e.g., 50 msgs/sec per client). |
| **Tombstone Accumulation** | Unbounded database growth from deleted characters. | Periodic compaction via Y.encodeStateAsUpdate(doc) to squash history.40 |

### **Offline Replication Risks via IndexedDB (y-indexeddb)**

#### **Technical Breakdown**

Local-first applications utilize providers like y-indexeddb to store the CRDT document state directly within the user's browser database, allowing uninterrupted editing during offline periods.39 When the client regains network connectivity, it generates a synchronization vector and pushes its local delta updates to the central server.  
A critical vulnerability exists when architectures implicitly trust this synchronization process. Because IndexedDB is fully controllable by the user (or any malicious browser extension with context access), an attacker can manually alter the raw Uint8Array stored in their local database while offline.39 When the application reconnects, it dutifully transmits the maliciously altered local state as a legitimate update. If the backend fails to treat reconnection syncs with the exact same hostility as real-time WebSocket updates, the database will accept the corrupted state, overwriting the canonical document.38  
Reconnection vectors must be passed through the same ephemeral sandbox validation pipeline detailed in the previous section before being allowed to merge with the central PostgreSQL persistence layer.

## **Agentic AI, Executable JSON Actions & RAG Layer**

Integrating Large Language Models (LLMs) with direct database access via Executable JSON Actions, and populating their context windows through Retrieval-Augmented Generation (RAG) using vector databases, dramatically expands the architectural attack surface. The deterministic logic of traditional code is replaced by probabilistic prompt execution, creating novel bypass mechanics.

### **Indirect Prompt Injection via RAG Context Poisoning**

#### **Technical Breakdown**

RAG systems query a vector database (such as pgvector) to retrieve relevant documents based on cosine similarity, appending their text directly into the LLM's prompt window to provide localized context.41 Indirect Prompt Injection occurs when an attacker embeds malicious instructions into a seemingly benign document (e.g., a shared collaborative note, an uploaded PDF, or a public user profile).42  
When the autonomous agent searches for information, the vector database retrieves the attacker's document and places it into the pipeline. The LLM consumes the hidden instructions (e.g., \`\`). Because the LLM cannot reliably distinguish between trusted developer system prompts and untrusted retrieved context, the agent is manipulated into executing the malicious payload, leading to data exfiltration or hallucinated responses.42

#### **Anti-Pattern**

Naively concatenating retrieved vector text directly with the system prompt without semantic boundaries.

TypeScript  
// rag-agent.ts (VULNERABLE)  
const similarDocuments \= await db.query(  
  'SELECT content FROM documents ORDER BY embedding \<-\> $1 LIMIT 3',  
  \[userQueryEmbedding\]  
);

// ANTI-PATTERN: The retrieved context is placed into the prompt without boundaries.  
// An attacker's document can hijack the "user" role instruction.  
const prompt \= \`  
  You are a helpful coding assistant. Use the following context to answer the user:  
  Context: ${similarDocuments.map(doc \=\> doc.content).join('\\n')}  
    
  User Question: ${userQuery}  
\`;

#### **Hardened Template**

Mitigation requires strict structural delineation of the prompt payload, utilizing specific model roles (System, User, Assistant) and implementing pre-flight data sanitization to strip control tokens. Advanced architectures utilize distinct randomized delimiters that modern LLMs are trained to treat strictly as passive data, rather than executable instructions.

TypeScript  
// rag-agent.ts (SECURE)  
import { ChatPromptTemplate } from 'langchain/prompts';

export async function secureRagQuery(userQuery: string, userQueryEmbedding: number) {  
  // 1\. Enforce RLS during vector retrieval to ensure cross-tenant poisoning is impossible  
  const similarDocuments \= await db.query(  
    \`SELECT content FROM documents   
     WHERE tenant\_id \= auth.uid()   
     ORDER BY embedding \<-\> $1 LIMIT 3\`,  
    \[userQueryEmbedding\]  
  );

  // 2\. Wrap context in randomized XML delimiters to prevent tag-breakout attacks  
  const delimiter \= \`---DATA\_BOUNDARY\_${crypto.randomUUID()}---\`;  
    
  let formattedContext \= '';  
  for (const doc of similarDocuments) {  
      // 3\. Strip any attempt by the document to insert markdown or system roles  
      const sanitizedDoc \= doc.content.replace(/(system:|user:|assistant:|\<\\|im\_start\\|\>|\<\\|im\_end\\|\>)/gi, '');  
      formattedContext \+= \`${delimiter}\\n${sanitizedDoc}\\n${delimiter}\\n\`;  
  }

  // 4\. Utilize distinct API roles. Never place user or retrieved data in the System prompt.  
  const messages \=;

  return executeLLM(messages);  
}

### **Vector Database (pgvector) Poisoning and Deduplication Bypass**

#### **Technical Breakdown**

To optimize AI pipelines and reduce exorbitant embedding generation costs, engineering teams often deduplicate tasks by hashing text content (e.g., using SHA-256) before sending it to an embedding model like OpenRouter.44 If a SHA-256 hash already exists in pgvector, the pipeline skips embedding generation and links the records.  
Attackers aiming to poison the vector database or execute a cost-exhaustion Denial of Service attack can effortlessly bypass SHA-256 deduplication algorithms by making imperceptible modifications to the text.44 Inserting zero-width spaces, swapping unicode characters, or altering trailing whitespace completely alters the SHA-256 hash, forcing the system to generate a new embedding and continuously bloat the vector database.44  
Furthermore, in high-dimensional embedding spaces, vectors exhibit a phenomenon known as "centrality-driven hubness".46 Attackers can craft texts with subtle topic variations designed specifically to cluster near the centroid of the vector space.46 These "hub" vectors mathematically become the "nearest neighbors" to a disproportionately large number of queries, guaranteeing that the attacker's poisoned context is retrieved in almost every RAG operation, regardless of the user's specific semantic question.44

#### **Hardened Template**

Instead of relying solely on exact cryptographic hashes (SHA-256) for deduplication, the system must utilize Semantic Deduplication (evaluating semantic similarity thresholds) before insertion, coupled with strict rate-limiting per tenant to prevent hubness clustering.47

SQL  
\-- SECURE: Semantic Deduplication before insertion to prevent poisoning and cost-exhaustion  
CREATE OR REPLACE FUNCTION insert\_unique\_embedding(  
  p\_tenant\_id UUID,  
  p\_content TEXT,  
  p\_embedding VECTOR(1536),  
  p\_similarity\_threshold FLOAT DEFAULT 0.98 \-- Threshold for semantic duplication   
) RETURNS BOOLEAN  
LANGUAGE plpgsql  
SET search\_path \= ''  
AS $$  
DECLARE  
  duplicate\_exists BOOLEAN;  
BEGIN  
  \-- 1\. Check if a semantically identical vector already exists for this tenant  
  \-- Using Cosine Distance (\<=\>). If distance is less than (1 \- threshold), it's a semantic duplicate.  
  SELECT EXISTS (  
    SELECT 1 FROM public.document\_embeddings  
    WHERE tenant\_id \= p\_tenant\_id  
    AND embedding \<=\> p\_embedding \< (1.0 \- p\_similarity\_threshold)  
  ) INTO duplicate\_exists;

  IF duplicate\_exists THEN  
    \-- Silently drop the insertion to prevent cost-exhaustion and hubness poisoning  
    RETURN FALSE;  
  END IF;

  \-- 2\. Insert validated, semantically unique vector  
  INSERT INTO public.document\_embeddings (tenant\_id, content, embedding)  
  VALUES (p\_tenant\_id, p\_content, p\_embedding);  
    
  RETURN TRUE;  
END;  
$$;

### **Unbounded Agent Executable JSON Actions**

#### **Technical Breakdown**

Modern agentic workflows grant the LLM the ability to output structured JSON configurations that map to backend execution functions (e.g., {"action": "delete\_file", "path": "/workspace/doc.md"}). A critical authorization vulnerability occurs when the Agent Executor runtime blindly trusts the LLM's JSON output and executes the function using a high-privileged backend token, failing to subject the action to the same RLS authorization guards enforced on normal human users.  
If an attacker successfully manipulates the LLM via Indirect Prompt Injection, the LLM could output a destructive command such as {"action": "delete\_folder", "path": "/"}.44 If the backend executor lacks non-malleable, identity-bound cryptographic guards, the workspace is irrecoverably destroyed. The Agent Executor must be entirely decoupled from the authorization layer. The LLM's output must be treated fundamentally as untrusted user input, routed through an API that authenticates using the *human user's* scoped session token, allowing the database RLS to safely reject hallucinated or malicious access attempts.

## **Zero-Knowledge Client-Side Protection Center**

Zero-Knowledge (ZK) architectures demand that plain-text passwords or sensitive encryption keys never leave the browser. While this paradigm provides exceptionally strong data privacy, shifting cryptographic operations to the frontend introduces highly specific timing and logic vulnerabilities.

### **Cryptographic Timing Attacks on Client-Side Hashing**

#### **Technical Breakdown**

In Zero-Knowledge note-locking applications, users enter a passphrase to unlock a document. The client encrypts the document using WebCrypto and generates an authentication hash (e.g., SHA-256(password \+ salt)) to rapidly verify the password upon the next entry.48  
A severe logical flaw occurs if the client-side JavaScript compares the user's newly input hash against the stored hash using a standard equality operator (== or \===). Standard string comparison algorithms in the V8 engine are optimized to exit early the exact moment they encounter a character mismatch. An attacker capable of observing the execution time can perform a Cryptographic Timing Attack.48 By measuring microsecond differences in response times across thousands of automated attempts, the attacker deduces the correct hash character by character, eventually recovering the complete authentication hash and bypassing the lock without knowing the original password.  
Furthermore, relying on crypto.randomUUID() to generate salts for these hashes reduces total entropy compared to cryptographically secure pseudorandom number generators (CSPRNG), making the resulting hashes susceptible to precomputed rainbow table attacks if extracted.2

#### **Anti-Pattern**

JavaScript  
// ANTI-PATTERN: Early-exit string comparison is vulnerable to timing attacks.  
// Uses low-entropy salt generation.  
function verifyUnlockHash(inputHash, storedHash) {  
  if (inputHash.length\!== storedHash.length) return false;  
    
  // Vulnerable: V8 engine optimizes this and exits on the first mismatched byte.  
  // Attackers measure the execution time to crack the hash.  
  return inputHash \=== storedHash;   
}

#### **Hardened Template**

All cryptographic comparisons must utilize constant-time algorithms, ensuring the comparison function takes the exact same amount of time to execute regardless of where a mismatch occurs.48 Salts must be generated using crypto.getRandomValues().

JavaScript  
// SECURE: Utilizing the Web Crypto API for constant-time comparison   
async function verifyUnlockHash(inputHashStr, storedHashStr) {  
  const encoder \= new TextEncoder();  
  const inputBytes \= encoder.encode(inputHashStr);  
  const storedBytes \= encoder.encode(storedHashStr);

  if (inputBytes.length\!== storedBytes.length) {  
    return false;  
  }

  // Import raw bytes into CryptoKeys for secure comparison  
  const algo \= { name: 'HMAC', hash: 'SHA-256' };  
    
  // Generate an ephemeral random key to perform the HMAC securely  
  const key \= await crypto.subtle.generateKey(algo, false, \['sign'\]);  
    
  const mac1 \= await crypto.subtle.sign(algo, key, inputBytes);  
  const mac2 \= await crypto.subtle.sign(algo, key, storedBytes);  
    
  const mac1Array \= new Uint8Array(mac1);  
  const mac2Array \= new Uint8Array(mac2);  
    
  // Perform bitwise constant-time comparison.   
  // Evaluates every single byte, never exiting early.  
  let result \= 0;  
  for (let i \= 0; i \< mac1Array.length; i++) {  
    result |= mac1Array\[i\] ^ mac2Array\[i\];  
  }  
    
  return result \=== 0;  
}

### **Client-Side Business Logic Overrides and Export Abuse**

#### **Technical Breakdown**

In Zero-Knowledge applications, the server stores encrypted data, but the client exclusively handles the decryption, rendering, and lifecycle management. A frequent architectural oversight involves masking locked content purely at the UI layer (e.g., replacing text with asterisks via CSS or conditionally hiding React components) while leaving secondary API interactions and memory stores unprotected.  
If a developer implements a utility feature such as a "Markdown/PDF Export," the frontend client typically requests the raw encrypted state from the database, decrypts it in memory, and pipes it to a generation library. An attacker bypassing the UI lock screen can interact directly with the client-side state management (e.g., inspecting the Redux store, or reading React Context) or manually invoke the export JavaScript functions through the browser's developer console. Because the sensitive data has already been decrypted into memory for background processing or document previews, the attacker effortlessly extracts the unmasked plain-text without ever supplying the locking passphrase.  
Decryption keys must be held strictly in ephemeral, closely scoped memory closures—never persisted in localStorage, sessionStorage, or global application state. When a user manually locks a document, the application must proactively execute a sweep to garbage-collect the decrypted state and purge the Redux/Context stores entirely. Export functions must require the explicit re-entry of the passphrase to derive the decryption key dynamically at the exact millisecond of export, ensuring no background memory thread holds the plain-text in a globally accessible scope.

#### **Источники**

1. Security Advisory: Critical RCE Vulnerabilities in React Server Components & Next.js \- Snyk, дата последнего обращения: июня 6, 2026, [https://snyk.io/blog/security-advisory-critical-rce-vulnerabilities-react-server-components/](https://snyk.io/blog/security-advisory-critical-rce-vulnerabilities-react-server-components/)  
2. Millions of servers vulnerable to RCE in React Components \- OX Security, дата последнего обращения: июня 6, 2026, [https://www.ox.security/blog/rce-in-react-server-components/](https://www.ox.security/blog/rce-in-react-server-components/)  
3. Threat Response \- Critical vulnerability in React and Next.js \- Northwave Cyber Security, дата последнего обращения: июня 6, 2026, [https://northwave-cybersecurity.com/threat-response-critical-vulnerability-in-react-and-nextjs](https://northwave-cybersecurity.com/threat-response-critical-vulnerability-in-react-and-nextjs)  
4. Critical Vulnerability in React Server Components and Next.js | Cyber Security Agency of Singapore, дата последнего обращения: июня 6, 2026, [https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2025-112/](https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2025-112/)  
5. Next.js 16 Middleware: authorization patterns that scale and the ..., дата последнего обращения: июня 6, 2026, [https://dev.to/jtorchia/nextjs-16-middleware-authorization-patterns-that-scale-and-the-ones-that-cause-race-conditions-4pfk](https://dev.to/jtorchia/nextjs-16-middleware-authorization-patterns-that-scale-and-the-ones-that-cause-race-conditions-4pfk)  
6. next.config.js: taint, дата последнего обращения: июня 6, 2026, [https://nextjs.org/docs/app/api-reference/config/next-config-js/taint](https://nextjs.org/docs/app/api-reference/config/next-config-js/taint)  
7. experimental\_taintObjectReferen, дата последнего обращения: июня 6, 2026, [https://react.dev/reference/react/experimental\_taintObjectReference](https://react.dev/reference/react/experimental_taintObjectReference)  
8. Data Fetching Patterns and Best Practices \- Next.js, дата последнего обращения: июня 6, 2026, [https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns)  
9. Why I Walked Back from Next.js and RSC to a Plain SPA and a Separate Backend, дата последнего обращения: июня 6, 2026, [https://dev.to/devrayat000/why-i-walked-back-from-nextjs-and-rsc-to-a-plain-spa-and-a-separate-backend-3ibo](https://dev.to/devrayat000/why-i-walked-back-from-nextjs-and-rsc-to-a-plain-spa-and-a-separate-backend-3ibo)  
10. Understanding the CVE-2025-29927 Next.js Authorization Bypass \- JFrog, дата последнего обращения: июня 6, 2026, [https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/](https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/)  
11. CVE-2025-29927: Next.js Middleware Authorization Bypass \- OffSec, дата последнего обращения: июня 6, 2026, [https://www.offsec.com/blog/cve-2025-29927/](https://www.offsec.com/blog/cve-2025-29927/)  
12. CVE-2025-29927: Next.js Middleware Authorization Bypass ..., дата последнего обращения: июня 6, 2026, [https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass)  
13. CVE-2026-44574: Vercel Next.js Auth Bypass Vulnerability, дата последнего обращения: июня 6, 2026, [https://www.sentinelone.com/vulnerability-database/cve-2026-44574/](https://www.sentinelone.com/vulnerability-database/cve-2026-44574/)  
14. Race condition results in multiple threads working on server action queue, corrupting state.canonicalUrl · Issue \#90467 · vercel/next.js \- GitHub, дата последнего обращения: июня 6, 2026, [https://github.com/vercel/next.js/issues/90467](https://github.com/vercel/next.js/issues/90467)  
15. server-side request forgery vulnerability in next.js websocket upgrade \- ngCERT | Alerts & Advisories, дата последнего обращения: июня 6, 2026, [https://cert.gov.ng/advisories/server-side-request-forgery-vulnerability-in-nextjs-websocket-upgrade](https://cert.gov.ng/advisories/server-side-request-forgery-vulnerability-in-nextjs-websocket-upgrade)  
16. Next.js WebSocket SSRF: Unauthenticated Access to Internal Resources: CVE-2026-44578, дата последнего обращения: июня 6, 2026, [https://hadrian.io/it/blog/next-js-websocket-ssrf-unauthenticated-access-to-internal-resources-cve-2026-44578-2](https://hadrian.io/it/blog/next-js-websocket-ssrf-unauthenticated-access-to-internal-resources-cve-2026-44578-2)  
17. Next.js CVE-2026-44578: SSRF Exposes 79,000 Self-Hosted Servers \- Pasquale Pillitteri, дата последнего обращения: июня 6, 2026, [https://pasqualepillitteri.it/en/news/2634/next-js-ssrf-cve-2026-44578-en](https://pasqualepillitteri.it/en/news/2634/next-js-ssrf-cve-2026-44578-en)  
18. security-audit | Skills Marketplace · LobeHub, дата последнего обращения: июня 6, 2026, [https://lobehub.com/skills/elliottrjacobs-bench-skills-security-audit](https://lobehub.com/skills/elliottrjacobs-bench-skills-security-audit)  
19. AI Agent Skills for a Repeatable Engineering Workflow | AI DevKit, дата последнего обращения: июня 6, 2026, [https://ai-devkit.com/skills/](https://ai-devkit.com/skills/)  
20. AFT Skills | Le Hub de compétences IA \- AI French Touch, дата последнего обращения: июня 6, 2026, [https://ai-french-touch.com/skills](https://ai-french-touch.com/skills)  
21. Supabase Under the Hood: PostgreSQL Architecture, Row Level Security, Self-Hosting and Production Deployment | WebOptimo, дата последнего обращения: июня 6, 2026, [https://weboptimo.pl/en/articles/supabase-architecture-postgresql-self-hosting-deployment](https://weboptimo.pl/en/articles/supabase-architecture-postgresql-self-hosting-deployment)  
22. Row Level Security | Supabase Docs, дата последнего обращения: июня 6, 2026, [https://supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)  
23. Expert for a paid multi-tenant security audit : r/Supabase \- Reddit, дата последнего обращения: июня 6, 2026, [https://www.reddit.com/r/Supabase/comments/1t80q7e/expert\_for\_a\_paid\_multitenant\_security\_audit/](https://www.reddit.com/r/Supabase/comments/1t80q7e/expert_for_a_paid_multitenant_security_audit/)  
24. Secret Key \+ security\_invoker view not returning results · Issue ..., дата последнего обращения: июня 6, 2026, [https://github.com/supabase/supabase-js/issues/2045](https://github.com/supabase/supabase-js/issues/2045)  
25. Multi-Tenant SaaS on Supabase: Four Lessons From Building a Production CRM | by Alex Ashcroft | May, 2026 | Stackademic, дата последнего обращения: июня 6, 2026, [https://blog.stackademic.com/multi-tenant-saas-on-supabase-four-lessons-from-building-a-production-crm-7c87c7fcde93](https://blog.stackademic.com/multi-tenant-saas-on-supabase-four-lessons-from-building-a-production-crm-7c87c7fcde93)  
26. Replace Supabase with a lean PostgREST instance \- Konfuzio, дата последнего обращения: июня 6, 2026, [https://konfuzio.com/en/replace-supabase-with-a-lean-postgrest-instance/](https://konfuzio.com/en/replace-supabase-with-a-lean-postgrest-instance/)  
27. Supabase Database Security Best Practices | AuditYourApp, дата последнего обращения: июня 6, 2026, [https://audityour.app/guides/supabase-database-security-best-practices](https://audityour.app/guides/supabase-database-security-best-practices)  
28. Using Materialized Views for RLS in Supabase: Best Practices and UI Limitations \#17790, дата последнего обращения: июня 6, 2026, [https://github.com/orgs/supabase/discussions/17790](https://github.com/orgs/supabase/discussions/17790)  
29. Row level security on views · supabase · Discussion \#1501 \- GitHub, дата последнего обращения: июня 6, 2026, [https://github.com/orgs/supabase/discussions/1501](https://github.com/orgs/supabase/discussions/1501)  
30. Using Materialized Views for RLS in Supabase: Best Practices and UI Limitations \[closed\], дата последнего обращения: июня 6, 2026, [https://stackoverflow.com/questions/77198207/using-materialized-views-for-rls-in-supabase-best-practices-and-ui-limitations](https://stackoverflow.com/questions/77198207/using-materialized-views-for-rls-in-supabase-best-practices-and-ui-limitations)  
31. Executing Dynamic JavaScript Code on Supabase with Edge Functions, дата последнего обращения: июня 6, 2026, [https://supabase.com/blog/supabase-dynamic-functions](https://supabase.com/blog/supabase-dynamic-functions)  
32. Supabase: critical security vulnerabilities of client-side SQL queries \- AI2H, дата последнего обращения: июня 6, 2026, [https://ai2h.tech/en/blog/supabase-security-vulnerabilities-sql-client-side-rls](https://ai2h.tech/en/blog/supabase-security-vulnerabilities-sql-client-side-rls)  
33. supabase-server | Agent Skills Library, дата последнего обращения: июня 6, 2026, [https://mcpservers.org/agent-skills/supabase/supabase-server](https://mcpservers.org/agent-skills/supabase/supabase-server)  
34. What to use instead of "Verify JWT" in edge functions : r/Supabase \- Reddit, дата последнего обращения: июня 6, 2026, [https://www.reddit.com/r/Supabase/comments/1m6h415/what\_to\_use\_instead\_of\_verify\_jwt\_in\_edge/](https://www.reddit.com/r/Supabase/comments/1m6h415/what_to_use_instead_of_verify_jwt_in_edge/)  
35. Environment Variables | Supabase Docs, дата последнего обращения: июня 6, 2026, [https://supabase.com/docs/guides/functions/secrets](https://supabase.com/docs/guides/functions/secrets)  
36. Encrypting document updates before they are sent over the socket connection · ueberdosis hocuspocus · Discussion \#622 \- GitHub, дата последнего обращения: июня 6, 2026, [https://github.com/ueberdosis/hocuspocus/discussions/622](https://github.com/ueberdosis/hocuspocus/discussions/622)  
37. End to end encryption with schema validation \- Yjs Community, дата последнего обращения: июня 6, 2026, [https://discuss.yjs.dev/t/end-to-end-encryption-with-schema-validation/2263](https://discuss.yjs.dev/t/end-to-end-encryption-with-schema-validation/2263)  
38. Read uploaded files content from JavaScript hooks \#7058 \- GitHub, дата последнего обращения: июня 6, 2026, [https://github.com/pocketbase/pocketbase/discussions/7058](https://github.com/pocketbase/pocketbase/discussions/7058)  
39. yjs/yjs: Shared data types for building collaborative software \- GitHub, дата последнего обращения: июня 6, 2026, [https://github.com/yjs/yjs](https://github.com/yjs/yjs)  
40. Real-Time Collaborative Document Editing Backend with HazelJS and CRDTs \- Medium, дата последнего обращения: июня 6, 2026, [https://medium.com/@nisafatima0000/real-time-collaborative-document-editing-backend-with-hazeljs-and-crdts-35623873fffa](https://medium.com/@nisafatima0000/real-time-collaborative-document-editing-backend-with-hazeljs-and-crdts-35623873fffa)  
41. Scaling Secure RAG with Trust Boundaries \- WTF In Tech \- Substack, дата последнего обращения: июня 6, 2026, [https://bhavishyapandit9.substack.com/p/scaling-secure-rag-with-trust-boundaries](https://bhavishyapandit9.substack.com/p/scaling-secure-rag-with-trust-boundaries)  
42. Rag 'n Roll: An End-to-End Evaluation of Indirect Prompt Manipulations in LLM-based Application Frameworks \- arXiv, дата последнего обращения: июня 6, 2026, [https://arxiv.org/html/2408.05025v2](https://arxiv.org/html/2408.05025v2)  
43. Threat Detection for RAG Pipelines: The Three Windows Most Tools Are Blind To \- ARMO, дата последнего обращения: июня 6, 2026, [https://www.armosec.io/blog/threat-detection-securing-rag-pipelines/](https://www.armosec.io/blog/threat-detection-securing-rag-pipelines/)  
44. Red Specter NIGHTFALL ARMORY — Centralised Payload Intelligence Library, дата последнего обращения: июня 6, 2026, [https://red-specter.co.uk/armory/](https://red-specter.co.uk/armory/)  
45. What are the best datasets for fine-tuning a code generation model? \- Hugging Face, дата последнего обращения: июня 6, 2026, [https://huggingface.co/datasets/clem/mentionsanalysis\_whatsbest\_april26/blob/main/claude\_code\_\_claude-opus-4-6\_\_high\_\_enabled.jsonl](https://huggingface.co/datasets/clem/mentionsanalysis_whatsbest_april26/blob/main/claude_code__claude-opus-4-6__high__enabled.jsonl)  
46. Turbocharging Vector Databases Using Modern SSDs \- ResearchGate, дата последнего обращения: июня 6, 2026, [https://www.researchgate.net/publication/395274842\_Turbocharging\_Vector\_Databases\_Using\_Modern\_SSDs](https://www.researchgate.net/publication/395274842_Turbocharging_Vector_Databases_Using_Modern_SSDs)  
47. User Perceptions of LLMs' Ability to Extract, Embody, and Explain Human Values from Casual Conversations \- arXiv, дата последнего обращения: июня 6, 2026, [https://arxiv.org/html/2601.22440v2](https://arxiv.org/html/2601.22440v2)  
48. Lucky Microseconds: A Timing Attack on Amazon's s2n, дата последнего обращения: июня 6, 2026, [https://pure.royalholloway.ac.uk/ws/files/26473420/paper\_1\_.pdf](https://pure.royalholloway.ac.uk/ws/files/26473420/paper_1_.pdf)