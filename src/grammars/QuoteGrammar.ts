export const grammar = `
<grammar root="quotes">
    <rule id="quotes">
    <ruleref uri="#quote"/>
       <tag>out.quote = new Object(); out.quote.author=rules.quote.type</tag>
    </rule>
    <rule id="author">
          <one-of>
             <item>to do is to be<tag>out="Socrates";</tag></item>
             <item>to be is to do<tag>out="Sartre";</tag></item>
             <item>do be do be do<tag>out="Sinatra";</tag></item>
          </one-of>
    </rule>
    <rule id="quote">
       <ruleref uri="#author"/>
       <tag>out.type=rules.author</tag>
    </rule>
 
 </grammar>
`