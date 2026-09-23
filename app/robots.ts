import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/api/","/admin","/me","/preview/"]},sitemap:"https://archi-landing.cloud/sitemap.xml"};}
