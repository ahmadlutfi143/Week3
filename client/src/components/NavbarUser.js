import { Link, useNavigate } from 'react-router-dom';
import DumbMerch from '../assets/DumbMerch.png'
import { useContext } from 'react'
import { UserContext } from '../context/userContext'
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

function NavbarUser() {

  let navigate = useNavigate()

  const [state, dispatch] = useContext(UserContext)
  const logout = () => {
      console.log(state)
      dispatch({
          type: "LOGOUT"
      })
      navigate("/auth")
  }
  return (
    <Navbar bg="black" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/user"><img src={DumbMerch} style={{ maxWidth: '50px' }} alt="" /></Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav>
            <Nav.Link as={Link} to="/user/complain" style={{ color:'white' }}>Complain</Nav.Link>
            <Nav.Link as={Link} to="/user/profile" style={{ color:'white' }}>Profile</Nav.Link>
            <Nav.Link onClick={logout} style={{ color:'white' }} >Logout</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavbarUser;