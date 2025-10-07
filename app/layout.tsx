export const metadata={title:'מתכנן טיולים',description:'MVP חינמי בעברית עם פאנל עריכה'};
import './../styles/globals.css';
import React from 'react';
export default function RootLayout({children}:{children:React.ReactNode}){
 return(<html lang='he' dir='rtl'><body>{children}</body></html>);
}
