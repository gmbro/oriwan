import {PublicSiteHeader} from '@/components/public-site-header';
import {PublicSiteFooter} from '@/components/public-site-footer';
import {FourthViewerProvider} from '@/components/fourth-viewer-provider';
import {getFourthViewer} from '@/lib/fourth-viewer-server';
import styles from '@/app/poc/hello-2027/hello-2027-poc.module.css';
export default async function Layout({children}:{children:React.ReactNode}){const viewer=await getFourthViewer();return <FourthViewerProvider initialViewer={viewer}><div className={styles.page}><PublicSiteHeader withDialog/><main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-9">{children}</main><PublicSiteFooter/></div></FourthViewerProvider>}
