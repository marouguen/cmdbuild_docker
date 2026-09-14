import { describe,it,expect,vi } from 'vitest';
import { ApiClient,ApiError } from '../../src/api/client';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
describe('REST client',()=>{
 it('sends the user session, disables caches and cookies',async()=>{
  const transport=vi.fn().mockResolvedValue(reply({success:true,data:[1]}));const api=new ApiClient('/api',transport);api.setSession('user-session');
  expect(await api.data('classes')).toEqual([1]);const init=transport.mock.calls[0][1];expect(init.headers.get('Cmdbuild-Authorization')).toBe('user-session');expect(init.credentials).toBe('omit');expect(init.cache).toBe('no-store');
 });
 it('expires and removes the session on 401',async()=>{const transport=vi.fn().mockResolvedValue(reply({},401));const api=new ApiClient('/api/',transport);api.onExpired=vi.fn();api.setSession('expired');await expect(api.data('classes')).rejects.toMatchObject({status:401});expect(api.onExpired).toHaveBeenCalledOnce();await api.data('classes').catch(()=>{});expect(transport.mock.calls[1][1].headers.has('Cmdbuild-Authorization')).toBe(false);});
 it('does not expire sessions on forbidden resource access',async()=>{const api=new ApiClient('/api/',vi.fn().mockResolvedValue(reply({},403)));api.setSession('valid');api.onExpired=vi.fn();await expect(api.data('classes')).rejects.toMatchObject({status:403});expect(api.onExpired).not.toHaveBeenCalled();});
 it('rejects success:false including HTTP 200',async()=>{const api=new ApiClient('/api/',vi.fn().mockResolvedValue(reply({success:false,messages:[{message:'Required field missing'}]})));await expect(api.data('x','PUT',{})).rejects.toThrow('Required field missing');});
 it('does not retry ambiguous writes',async()=>{const transport=vi.fn().mockRejectedValue(Error('network'));const api=new ApiClient('/api/',transport);await expect(api.data('x','PUT',{})).rejects.toMatchObject({uncertain:true});expect(transport).toHaveBeenCalledOnce();});
 it('rejects responses from a previous login',async()=>{let resolve!:(r:Response)=>void;const api=new ApiClient('/api/',()=>new Promise(r=>resolve=r));api.setSession('a');const pending=api.data('classes');api.setSession('b');resolve(reply({success:true,data:['private']}));await expect(pending).rejects.toThrow('Session changed');});
 it('does not send tokens to absolute URLs',async()=>{const transport=vi.fn();const api=new ApiClient('/api/',transport);await expect(api.raw('https://example.org')).rejects.toBeInstanceOf(ApiError);expect(transport).not.toHaveBeenCalled();});
 it('marks malformed write responses uncertain',async()=>{const api=new ApiClient('/api/',vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>')));await expect(api.data('x','POST',{})).rejects.toMatchObject({uncertain:true});});
});
